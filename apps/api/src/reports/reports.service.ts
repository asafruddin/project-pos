import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  grantsFor,
  hasPermission,
  inventoryStockValueMinor,
  isDeadStock,
  rankProductAnalytics,
  saleDiscountMinor,
  summarizeOpnameVariance,
  summarizeProductAnalytics,
  summarizeSalesAnalytics,
} from "@pos-apps/domain";
import type { Role } from "@pos-apps/types";
import {
  STORE_1_ID,
  type ReportCashiersResponse,
  type ReportInventoryResponse,
  type ReportProductRow,
  type ReportProductsResponse,
  type ReportSummary,
} from "@pos-apps/types";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  products,
  saleReturns,
  sales,
  saleVoids,
  shifts,
  stockMovements,
  stockOpnameLines,
  stockOpnames,
  users,
} from "../db/schema";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function utcDay(isoDate: string): Date | null {
  if (!DATE.test(isoDate)) return null;
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseReportRange(
  from?: string,
  to?: string,
): { start: Date; end: Date; from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const fromStr = from?.trim() || today;
  const toStr = to?.trim() || today;
  const start = utcDay(fromStr);
  const endDay = utcDay(toStr);
  if (!start || !endDay) {
    throw new BadRequestException({
      code: "REPORT_INVALID_RANGE",
      message: "Rentang tanggal tidak valid (YYYY-MM-DD).",
    });
  }
  if (endDay.getTime() < start.getTime()) {
    throw new BadRequestException({
      code: "REPORT_INVALID_RANGE",
      message: "Tanggal akhir harus setelah atau sama dengan tanggal awal.",
    });
  }
  const days =
    Math.round((endDay.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException({
      code: "REPORT_INVALID_RANGE",
      message: "Rentang laporan maksimal 366 hari.",
    });
  }
  const end = new Date(endDay);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, from: fromStr, to: toStr };
}

function resolveStore(storeId?: string): string {
  if (storeId && storeId !== STORE_1_ID) {
    throw new BadRequestException({
      code: "REPORT_INVALID_STORE",
      message: "Laporan hanya untuk Store #1.",
    });
  }
  return STORE_1_ID;
}

type Viewer = { userId: string; role: Role; permissions?: string[] };

type LoadedSale = {
  saleId: string;
  amountMinor: number;
  lines: Array<{ product_id: string; qty: number; price_minor: number }>;
  loyalty: { discount_minor?: number } | null;
  promotions: {
    discount_minor?: number;
    manager_discount_minor?: number;
    voucher_minor?: number;
  } | null;
  shiftId: string | null;
  voidedAt: Date | null;
};

type LoadedRefund = {
  saleId: string;
  shiftId: string | null;
  saleShiftId: string | null;
  refund_amount_minor: number;
};

function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  return `"${value.replace(/"/g, '""')}"`;
}

function actorOf(
  shiftId: string | null,
  actorByShift: Map<string, string | null>,
): string | null {
  if (!shiftId) return null;
  return actorByShift.get(shiftId) ?? null;
}

@Injectable()
export class ReportsService {
  async summary(
    query: { from?: string; to?: string; store_id?: string },
    viewer: Viewer,
  ): Promise<ReportSummary> {
    const { range, costs } = await this.loadSalesPeriod(query, viewer);
    const totals = summarizeSalesAnalytics({
      sales: range.sales.map((sale) => this.toReportSale(sale, costs)),
      refunds: range.refunds,
    });
    const base: ReportSummary = {
      store_id: STORE_1_ID,
      from: range.from,
      to: range.to,
      revenue_minor: totals.revenue_minor,
      txn_count: totals.txn_count,
      units: totals.units,
      aov_minor: totals.aov_minor,
      discount_minor: totals.discount_minor,
      refund_minor: totals.refund_minor,
      net_minor: totals.net_minor,
    };
    if (!hasPermission(grantsFor(viewer), "reports", "view_financial")) return base;
    return {
      ...base,
      cogs_minor: totals.cogs_minor,
      gross_profit_minor: totals.gross_profit_minor,
      tax_minor: totals.tax_minor,
      fees_minor: totals.fees_minor,
    };
  }

  async products(
    query: { from?: string; to?: string; store_id?: string },
    viewer: Viewer,
  ): Promise<ReportProductsResponse> {
    const { range, costs, names } = await this.loadSalesPeriod(query, viewer);
    const aggs = summarizeProductAnalytics({
      sales: range.sales.map((sale) => this.toReportSale(sale, costs)),
    });
    const ranked = rankProductAnalytics(aggs);
    return {
      store_id: STORE_1_ID,
      from: range.from,
      to: range.to,
      top: ranked.top.map((row) => this.toProductRow(row, names, viewer)),
      slow: ranked.slow.map((row) => this.toProductRow(row, names, viewer)),
    };
  }

  async inventory(
    query: { from?: string; to?: string; store_id?: string },
    viewer: Viewer,
  ): Promise<ReportInventoryResponse> {
    if (!hasPermission(grantsFor(viewer), "reports", "view_financial")) {
      throw new ForbiddenException({
        code: "REPORT_FORBIDDEN",
        message: "Analitik stok hanya untuk admin.",
      });
    }
    const storeId = resolveStore(query.store_id);
    const { start, end, from, to } = parseReportRange(query.from, query.to);
    const db = getDb();

    const catalog = await db
      .select({
        productId: products.productId,
        name: products.name,
        costMinor: products.costMinor,
      })
      .from(products);

    const bucketSums = await db
      .select({
        productId: stockMovements.productId,
        bucket: stockMovements.bucket,
        qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.storeId, storeId))
      .groupBy(stockMovements.productId, stockMovements.bucket);

    const sellable = new Map<string, number>();
    for (const row of bucketSums) {
      if (row.bucket === "sellable") sellable.set(row.productId, toQty(row.qty));
    }

    const periodMoves = await db
      .select({
        reason: stockMovements.reason,
        qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          gte(stockMovements.at, start),
          lt(stockMovements.at, end),
        ),
      )
      .groupBy(stockMovements.reason);

    const opnameHeaders = await db
      .select({
        opnameId: stockOpnames.opnameId,
        status: stockOpnames.status,
      })
      .from(stockOpnames)
      .where(
        and(
          eq(stockOpnames.storeId, storeId),
          eq(stockOpnames.status, "approved"),
          gte(stockOpnames.decidedAt, start),
          lt(stockOpnames.decidedAt, end),
        ),
      );

    const opnameIds = opnameHeaders.map((h) => h.opnameId);
    const opnameLineRows =
      opnameIds.length === 0
        ? []
        : await db
            .select({
              opnameId: stockOpnameLines.opnameId,
              systemQty: stockOpnameLines.systemQty,
              countedQty: stockOpnameLines.countedQty,
            })
            .from(stockOpnameLines)
            .where(inArray(stockOpnameLines.opnameId, opnameIds));

    const linesByOpname = new Map<
      string,
      Array<{ system_qty: number; counted_qty: number | null }>
    >();
    for (const line of opnameLineRows) {
      const list = linesByOpname.get(line.opnameId) ?? [];
      list.push({
        system_qty: line.systemQty,
        counted_qty: line.countedQty,
      });
      linesByOpname.set(line.opnameId, list);
    }

    const { range, costs } = await this.loadSalesPeriod(query, viewer);
    const sold = new Map<string, number>();
    for (const agg of summarizeProductAnalytics({
      sales: range.sales.map((sale) => this.toReportSale(sale, costs)),
    })) {
      sold.set(agg.product_id, agg.units);
    }

    const valueRows = catalog.map((p) => ({
      sellable_qty: sellable.get(p.productId) ?? 0,
      cost_minor: p.costMinor,
    }));

    return {
      store_id: storeId,
      from,
      to,
      stock_value_minor: inventoryStockValueMinor(valueRows),
      movements: periodMoves.map((row) => ({
        reason: row.reason,
        qty_delta: toQty(row.qty),
      })),
      opname_variances: opnameHeaders
        .map((h) =>
          summarizeOpnameVariance({
            opname_id: h.opnameId,
            status: h.status,
            lines: linesByOpname.get(h.opnameId) ?? [],
          }),
        )
        .filter((row): row is NonNullable<typeof row> => row != null),
      dead_stock: catalog
        .filter((p) =>
          isDeadStock({
            sellable_qty: sellable.get(p.productId) ?? 0,
            units_sold: sold.get(p.productId) ?? 0,
          }),
        )
        .map((p) => ({
          product_id: p.productId,
          name: p.name,
          sellable_qty: sellable.get(p.productId) ?? 0,
        })),
    };
  }

  async cashiers(
    query: { from?: string; to?: string; store_id?: string },
    viewer: Viewer,
  ): Promise<ReportCashiersResponse> {
    const { range, actorByShift } = await this.loadSalesPeriod(query, viewer);
    const db = getDb();
    const userRows = await db
      .select({ userId: users.userId, username: users.username })
      .from(users);
    const nameById = new Map(userRows.map((u) => [u.userId, u.username]));

    const saleShift = new Map(
      range.sales.map((s) => [s.saleId, s.shiftId]),
    );

    type Acc = {
      cashier_id: string | null;
      shift_id: string | null;
      revenue_minor: number;
      txn_count: number;
      refund_minor: number;
    };
    const byKey = new Map<string, Acc>();
    function bucket(cashierId: string | null, shiftId: string | null): Acc {
      const key = `${cashierId ?? ""}:${shiftId ?? ""}`;
      const cur = byKey.get(key) ?? {
        cashier_id: cashierId,
        shift_id: shiftId,
        revenue_minor: 0,
        txn_count: 0,
        refund_minor: 0,
      };
      byKey.set(key, cur);
      return cur;
    }

    for (const sale of range.sales) {
      if (sale.voidedAt) continue;
      const shiftId = sale.shiftId;
      const cashierId = shiftId ? (actorByShift.get(shiftId) ?? null) : null;
      const acc = bucket(cashierId, shiftId);
      acc.revenue_minor += sale.amountMinor;
      acc.txn_count += 1;
    }

    for (const refund of range.refundRows) {
      const shiftId =
        saleShift.get(refund.saleId) ??
        refund.saleShiftId ??
        refund.shiftId;
      const cashierId = shiftId ? (actorByShift.get(shiftId) ?? null) : null;
      bucket(cashierId, shiftId).refund_minor += refund.refund_amount_minor;
    }

    let cashiers = [...byKey.values()].map((row) => ({
      cashier_id: row.cashier_id,
      cashier_username: row.cashier_id
        ? (nameById.get(row.cashier_id) ?? null)
        : null,
      shift_id: row.shift_id,
      revenue_minor: row.revenue_minor,
      txn_count: row.txn_count,
      refund_minor: row.refund_minor,
    }));

    if (!hasPermission(grantsFor(viewer), "reports", "view_financial")) {
      cashiers = cashiers.filter((row) => row.cashier_id === viewer.userId);
    }

    return {
      store_id: STORE_1_ID,
      from: range.from,
      to: range.to,
      cashiers,
    };
  }

  async exportCsv(
    query: { from?: string; to?: string; store_id?: string },
    viewer: Viewer,
  ): Promise<string> {
    if (!hasPermission(grantsFor(viewer), "reports", "export")) {
      throw new ForbiddenException({
        code: "REPORT_FORBIDDEN",
        message: "Ekspor laporan hanya untuk admin.",
      });
    }
    const { range, costs, names } = await this.loadSalesPeriod(query, viewer);
    const totals = summarizeSalesAnalytics({
      sales: range.sales.map((sale) => this.toReportSale(sale, costs)),
      refunds: range.refunds,
    });
    const productRows = summarizeProductAnalytics({
      sales: range.sales.map((sale) => this.toReportSale(sale, costs)),
    }).map((row) => this.toProductRow(row, names, viewer));
    const lines = [
      [
        "store_id",
        "from",
        "to",
        "revenue_minor",
        "txn_count",
        "units",
        "aov_minor",
        "discount_minor",
        "refund_minor",
        "net_minor",
        "cogs_minor",
        "gross_profit_minor",
        "tax_minor",
        "fees_minor",
      ].join(","),
      [
        STORE_1_ID,
        range.from,
        range.to,
        totals.revenue_minor,
        totals.txn_count,
        totals.units,
        totals.aov_minor,
        totals.discount_minor,
        totals.refund_minor,
        totals.net_minor,
        totals.cogs_minor,
        totals.gross_profit_minor,
        totals.tax_minor,
        totals.fees_minor,
      ]
        .map(csvCell)
        .join(","),
      "",
      ["product_id", "name", "status", "units", "revenue_minor", "cogs_minor", "margin_minor"].join(
        ",",
      ),
      ...productRows.map((row) =>
        [
          row.product_id,
          row.name,
          row.status,
          row.units,
          row.revenue_minor,
          row.cogs_minor ?? 0,
          row.margin_minor ?? 0,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    return `${lines.join("\n")}\n`;
  }

  private toReportSale(
    sale: LoadedSale,
    costs: Map<string, number | null>,
  ) {
    return {
      amount_minor: sale.amountMinor,
      voided: Boolean(sale.voidedAt),
      discount_minor: saleDiscountMinor({
        promotions: sale.promotions,
        loyalty: sale.loyalty,
      }),
      lines: (sale.lines ?? []).map((line) => ({
        product_id: line.product_id,
        qty: line.qty,
        price_minor: line.price_minor,
        cost_minor: costs.get(line.product_id) ?? null,
      })),
    };
  }

  private toProductRow(
    row: {
      product_id: string;
      units: number;
      revenue_minor: number;
      cogs_minor: number;
      margin_minor: number;
    },
    names: Map<string, { name: string; status: "active" | "inactive" }>,
    viewer: Viewer,
  ): ReportProductRow {
    const meta = names.get(row.product_id);
    const base: ReportProductRow = {
      product_id: row.product_id,
      name: meta?.name ?? row.product_id,
      status: meta?.status ?? "inactive",
      units: row.units,
      revenue_minor: row.revenue_minor,
    };
    if (!hasPermission(grantsFor(viewer), "reports", "view_financial")) return base;
    return {
      ...base,
      cogs_minor: row.cogs_minor,
      margin_minor: row.margin_minor,
    };
  }

  private async loadSalesPeriod(
    query: {
      from?: string;
      to?: string;
      store_id?: string;
    },
    viewer: Viewer,
  ) {
    const storeId = resolveStore(query.store_id);
    const { start, end, from, to } = parseReportRange(query.from, query.to);
    const db = getDb();

    const saleRows = await db
      .select({
        saleId: sales.saleId,
        amountMinor: sales.amountMinor,
        lines: sales.lines,
        loyalty: sales.loyalty,
        promotions: sales.promotions,
        shiftId: sales.shiftId,
        voidedAt: saleVoids.voidedAt,
      })
      .from(sales)
      .leftJoin(saleVoids, eq(saleVoids.saleId, sales.saleId))
      .where(
        and(
          eq(sales.storeId, storeId),
          gte(sales.completedAt, start),
          lt(sales.completedAt, end),
        ),
      );

    const refundRows = await db
      .select({
        saleId: saleReturns.saleId,
        refundAmountMinor: saleReturns.refundAmountMinor,
        shiftId: saleReturns.shiftId,
        saleShiftId: sales.shiftId,
      })
      .from(saleReturns)
      .innerJoin(sales, eq(sales.saleId, saleReturns.saleId))
      .where(
        and(
          eq(sales.storeId, storeId),
          eq(saleReturns.status, "refunded"),
          gte(saleReturns.refundedAt, start),
          lt(saleReturns.refundedAt, end),
        ),
      );

    const catalog = await db
      .select({
        productId: products.productId,
        name: products.name,
        status: products.status,
        costMinor: products.costMinor,
      })
      .from(products);

    const costs = new Map(catalog.map((p) => [p.productId, p.costMinor]));
    const names = new Map(
      catalog.map((p) => [p.productId, { name: p.name, status: p.status }]),
    );

    const shiftRows = await db
      .select({
        shiftId: shifts.shiftId,
        actorId: shifts.actorId,
      })
      .from(shifts)
      .where(eq(shifts.storeId, storeId));
    const actorByShift = new Map(
      shiftRows.map((s) => [s.shiftId, s.actorId ?? null]),
    );

    let salesLoaded: LoadedSale[] = saleRows.map((row) => ({
      saleId: row.saleId,
      amountMinor: row.amountMinor,
      lines: row.lines ?? [],
      loyalty: row.loyalty,
      promotions: row.promotions,
      shiftId: row.shiftId,
      voidedAt: row.voidedAt,
    }));

    let refunds: LoadedRefund[] = refundRows.map((row) => ({
      saleId: row.saleId,
      shiftId: row.shiftId,
      saleShiftId: row.saleShiftId,
      refund_amount_minor: row.refundAmountMinor ?? 0,
    }));

    if (!hasPermission(grantsFor(viewer), "reports", "view_financial")) {
      salesLoaded = salesLoaded.filter(
        (sale) => actorOf(sale.shiftId, actorByShift) === viewer.userId,
      );
      refunds = refunds.filter(
        (refund) =>
          actorOf(refund.saleShiftId ?? refund.shiftId, actorByShift) ===
          viewer.userId,
      );
    }

    return {
      range: {
        from,
        to,
        sales: salesLoaded,
        refunds: refunds.map((r) => ({
          refund_amount_minor: r.refund_amount_minor,
        })),
        refundRows: refunds,
      },
      costs,
      names,
      actorByShift,
    };
  }
}
