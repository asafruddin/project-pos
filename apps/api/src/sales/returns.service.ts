import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { approveRefund, postReturn } from "@pos-apps/domain";
import type {
  CreateReturnRequest,
  LinkExchangeSaleRequest,
  RefundReturnRequest,
  ReturnDetail,
  ReturnListResponse,
  SaleLookupResponse,
} from "@pos-apps/types";
import { REGISTER_1_ID, STORE_1_ID } from "@pos-apps/types";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import {
  products,
  saleReturnLines,
  saleReturns,
  sales,
  saleVoids,
  shifts,
} from "../db/schema";

@Injectable()
export class ReturnsService {
  async lookup(saleId: string): Promise<SaleLookupResponse> {
    const db = getDb();
    const saleRows = await db
      .select()
      .from(sales)
      .where(eq(sales.saleId, saleId))
      .limit(1);
    const sale = saleRows[0];
    if (!sale) {
      throw new NotFoundException({
        code: "SALE_NOT_FOUND",
        message: "Penjualan tidak ditemukan. Cek ID atau unggah dulu.",
      });
    }
    const voidRow = await db
      .select({ voidedAt: saleVoids.voidedAt })
      .from(saleVoids)
      .where(eq(saleVoids.saleId, saleId))
      .limit(1);
    const returned = await returnedQtyByProduct(saleId);
    const names = await productNames(sale.lines.map((line) => line.product_id));
    return {
      sale_id: sale.saleId,
      completed_at: sale.completedAt.toISOString(),
      amount_minor: sale.amountMinor,
      voided_at: voidRow[0]?.voidedAt?.toISOString() ?? null,
      lines: sale.lines.map((line) => ({
        product_id: line.product_id,
        name: names.get(line.product_id) ?? null,
        qty: line.qty,
        price_minor: line.price_minor,
        returned_qty: returned.get(line.product_id) ?? 0,
      })),
    };
  }

  async create(
    saleId: string,
    input: CreateReturnRequest,
    actorId?: string,
  ): Promise<ReturnDetail> {
    const db = getDb();
    const returnId = await db.transaction(async (tx) => {
      const saleRows = await tx
        .select()
        .from(sales)
        .where(eq(sales.saleId, saleId))
        .limit(1);
      const sale = saleRows[0];
      if (!sale) {
        throw new NotFoundException({
          code: "SALE_NOT_FOUND",
          message: "Penjualan tidak ditemukan. Cek ID atau unggah dulu.",
        });
      }
      const voidRow = await tx
        .select({ voidId: saleVoids.voidId })
        .from(saleVoids)
        .where(eq(saleVoids.saleId, saleId))
        .limit(1);
      const returned = await returnedQtyByProduct(saleId);
      const sold = new Map(sale.lines.map((line) => [line.product_id, line]));
      const parsed = postReturn({
        sale_complete: true,
        already_voided: Boolean(voidRow[0]),
        reason: input.reason ?? "",
        lines: (input.lines ?? []).map((line) => ({
          product_id: line.product_id,
          sold_qty: sold.get(line.product_id)?.qty ?? 0,
          already_returned_qty: returned.get(line.product_id) ?? 0,
          return_qty: line.qty,
          decision: line.decision,
        })),
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }
      for (const line of parsed.lines) {
        if (!sold.has(line.product_id)) {
          throw new BadRequestException({
            code: "RETURN_INVALID",
            message: "Produk tidak ada pada penjualan ini.",
          });
        }
      }

      let exchangeSaleId: string | null = null;
      if (input.exchange_sale_id) {
        exchangeSaleId = await requireOtherSale(input.exchange_sale_id, saleId);
      }

      const inserted = await tx
        .insert(saleReturns)
        .values({
          saleId,
          reason: (input.reason ?? "").trim(),
          status: "open",
          exchangeSaleId,
          createdBy: actorId ?? null,
        })
        .returning({ returnId: saleReturns.returnId });
      const id = inserted[0]!.returnId;

      for (const line of parsed.lines) {
        await tx.insert(saleReturnLines).values({
          returnId: id,
          productId: line.product_id,
          qty: line.qty,
          decision: line.decision,
        });
      }

      const productIds = [
        ...new Set(parsed.movements.map((row) => row.product_id)),
      ];
      const stock =
        productIds.length === 0
          ? []
          : await tx
              .select({
                productId: products.productId,
                stockQty: products.stockQty,
              })
              .from(products)
              .where(inArray(products.productId, productIds))
              .for("update");
      const byId = new Map(stock.map((row) => [row.productId, row]));

      for (const movement of parsed.movements) {
        const product = byId.get(movement.product_id);
        if (!product) {
          throw new BadRequestException({
            code: "RETURN_INVALID",
            message: "Produk tidak ditemukan.",
          });
        }
        await insertStockMovement(tx, {
          productId: movement.product_id,
          storeId: sale.storeId,
          qtyDelta: movement.qty,
          bucket: movement.bucket,
          reason: "retur penjualan",
          sourceType: "return",
          sourceId: id,
          actorId: actorId ?? null,
        });
        if (movement.bucket === "sellable" && sale.storeId === STORE_1_ID) {
          const next = product.stockQty + movement.qty;
          byId.set(movement.product_id, { ...product, stockQty: next });
          await tx
            .update(products)
            .set({ stockQty: next, updatedAt: new Date() })
            .where(eq(products.productId, movement.product_id));
        }
      }
      return id;
    });
    return this.get(returnId);
  }

  async listOpen(): Promise<ReturnListResponse> {
    const db = getDb();
    const rows = await db
      .select({ returnId: saleReturns.returnId })
      .from(saleReturns)
      .where(eq(saleReturns.status, "open"));
    const details: ReturnDetail[] = [];
    for (const row of rows) {
      details.push(await this.get(row.returnId));
    }
    return { returns: details };
  }

  async get(returnId: string): Promise<ReturnDetail> {
    const db = getDb();
    const headers = await db
      .select()
      .from(saleReturns)
      .where(eq(saleReturns.returnId, returnId))
      .limit(1);
    const header = headers[0];
    if (!header) {
      throw new NotFoundException({
        code: "RETURN_NOT_FOUND",
        message: "Retur tidak ditemukan.",
      });
    }
    const lines = await db
      .select()
      .from(saleReturnLines)
      .where(eq(saleReturnLines.returnId, returnId));
    const saleRows = await db
      .select()
      .from(sales)
      .where(eq(sales.saleId, header.saleId))
      .limit(1);
    const sale = saleRows[0];
    const price = new Map(
      (sale?.lines ?? []).map((line) => [line.product_id, line.price_minor]),
    );
    const names = await productNames(lines.map((line) => line.productId));
    const mapped = lines.map((line) => ({
      product_id: line.productId,
      name: names.get(line.productId) ?? null,
      qty: line.qty,
      decision: line.decision,
      price_minor: price.get(line.productId) ?? 0,
    }));
    const amount_minor = mapped.reduce(
      (sum, line) => sum + line.qty * line.price_minor,
      0,
    );
    return {
      return_id: header.returnId,
      sale_id: header.saleId,
      reason: header.reason,
      status: header.status,
      amount_minor,
      refund_amount_minor: header.refundAmountMinor,
      refunded_at: header.refundedAt?.toISOString() ?? null,
      exchange_sale_id: header.exchangeSaleId,
      lines: mapped,
      created_at: header.createdAt.toISOString(),
    };
  }

  async refund(
    returnId: string,
    input: RefundReturnRequest,
    actorId?: string,
  ): Promise<ReturnDetail> {
    const current = await this.get(returnId);
    const parsed = approveRefund({
      return_status: current.status,
      amount_minor: input.amount_minor,
      expected_minor: current.amount_minor,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const db = getDb();
    const openShiftRows = await db
      .select({ shiftId: shifts.shiftId })
      .from(shifts)
      .where(
        and(eq(shifts.registerId, REGISTER_1_ID), eq(shifts.status, "open")),
      )
      .limit(1);
    const saleShiftRows = await db
      .select({ shiftId: sales.shiftId })
      .from(sales)
      .where(eq(sales.saleId, current.sale_id))
      .limit(1);
    const shiftId =
      openShiftRows[0]?.shiftId ?? saleShiftRows[0]?.shiftId ?? null;
    await db
      .update(saleReturns)
      .set({
        status: "refunded",
        refundAmountMinor: parsed.amount_minor,
        refundedAt: new Date(),
        refundedBy: actorId ?? null,
        shiftId,
      })
      .where(eq(saleReturns.returnId, returnId));
    return this.get(returnId);
  }

  async linkExchange(
    returnId: string,
    input: LinkExchangeSaleRequest,
  ): Promise<ReturnDetail> {
    const current = await this.get(returnId);
    const db = getDb();
    await db.transaction(async (tx) => {
      await requireOtherSale(input.exchange_sale_id, current.sale_id);
      await tx
        .update(saleReturns)
        .set({ exchangeSaleId: input.exchange_sale_id })
        .where(eq(saleReturns.returnId, returnId));
    });
    return this.get(returnId);
  }
}

async function returnedQtyByProduct(saleId: string): Promise<Map<string, number>> {
  const headers = await getDb()
    .select({ returnId: saleReturns.returnId })
    .from(saleReturns)
    .where(eq(saleReturns.saleId, saleId));
  const ids = headers.map((row) => row.returnId);
  const qty = new Map<string, number>();
  if (!ids.length) return qty;
  const lines = await getDb()
    .select()
    .from(saleReturnLines)
    .where(inArray(saleReturnLines.returnId, ids));
  for (const line of lines) {
    qty.set(line.productId, (qty.get(line.productId) ?? 0) + line.qty);
  }
  return qty;
}

async function productNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const rows = await getDb()
    .select({ productId: products.productId, name: products.name })
    .from(products)
    .where(inArray(products.productId, unique));
  for (const row of rows) names.set(row.productId, row.name);
  return names;
}

async function requireOtherSale(
  exchangeSaleId: string,
  originalSaleId: string,
): Promise<string> {
  if (exchangeSaleId === originalSaleId) {
    throw new BadRequestException({
      code: "RETURN_INVALID",
      message: "Penjualan tukar harus penjualan baru, bukan penjualan asli.",
    });
  }
  const rows = await getDb()
    .select({ saleId: sales.saleId })
    .from(sales)
    .where(eq(sales.saleId, exchangeSaleId))
    .limit(1);
  if (!rows[0]) {
    throw new BadRequestException({
      code: "RETURN_INVALID",
      message: "Penjualan tukar tidak ditemukan. Selesaikan penjualan baru dulu.",
    });
  }
  return exchangeSaleId;
}
