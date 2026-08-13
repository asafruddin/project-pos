import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { applyOpname } from "@pos-apps/domain";
import {
  STORE_1_ID,
  type OpnameDetail,
  type OpnameListResponse,
  type OpnameLine,
} from "@pos-apps/types";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, stockMovements, stockOpnameLines, stockOpnames } from "../db/schema";
import { insertStockMovement } from "../db/stock-ledger";

function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

@Injectable()
export class OpnameService {
  async list(): Promise<OpnameListResponse> {
    const rows = await getDb()
      .select({
        opnameId: stockOpnames.opnameId,
        status: stockOpnames.status,
        createdAt: stockOpnames.createdAt,
        productCount: sql<string>`count(${stockOpnameLines.productId})`,
      })
      .from(stockOpnames)
      .leftJoin(
        stockOpnameLines,
        eq(stockOpnameLines.opnameId, stockOpnames.opnameId),
      )
      .groupBy(stockOpnames.opnameId, stockOpnames.status, stockOpnames.createdAt)
      .orderBy(desc(stockOpnames.createdAt));

    return {
      opnames: rows.map((row) => ({
        opname_id: row.opnameId,
        status: row.status,
        created_at: row.createdAt.toISOString(),
        product_count: toQty(row.productCount),
      })),
    };
  }

  async get(opnameId: string): Promise<OpnameDetail> {
    const detail = await this.loadDetail(opnameId);
    if (!detail) {
      throw new NotFoundException({
        code: "OPNAME_NOT_FOUND",
        message: "Opname tidak ditemukan.",
      });
    }
    return detail;
  }

  async create(
    input: { product_ids: string[] },
    actorId?: string,
  ): Promise<OpnameDetail> {
    const productIds = [...new Set(input.product_ids)];
    if (!productIds.length) {
      throw new BadRequestException({
        code: "OPNAME_INVALID",
        message: "Pilih minimal satu produk.",
      });
    }

    const opnameId = await getDb().transaction(async (tx) => {
      const productRows = await tx
        .select({
          productId: products.productId,
        })
        .from(products)
        .where(inArray(products.productId, productIds));
      if (productRows.length !== productIds.length) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }

      const sums = await tx
        .select({
          productId: stockMovements.productId,
          qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.storeId, STORE_1_ID),
            eq(stockMovements.bucket, "sellable"),
            inArray(stockMovements.productId, productIds),
          ),
        )
        .groupBy(stockMovements.productId);
      const byProduct = new Map(
        sums.map((row) => [row.productId, toQty(row.qty)]),
      );

      const [header] = await tx
        .insert(stockOpnames)
        .values({
          storeId: STORE_1_ID,
          status: "draft",
          createdBy: actorId ?? null,
        })
        .returning();
      if (!header) {
        throw new BadRequestException({
          code: "OPNAME_INVALID",
          message: "Gagal membuat opname.",
        });
      }

      await tx.insert(stockOpnameLines).values(
        productIds.map((productId) => ({
          opnameId: header.opnameId,
          productId,
          systemQty: byProduct.get(productId) ?? 0,
        })),
      );
      return header.opnameId;
    });

    return this.get(opnameId);
  }

  async saveCounts(
    opnameId: string,
    input: { lines: Array<{ product_id: string; counted_qty: number }> },
  ): Promise<OpnameDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lockDraft(tx, opnameId);
      const existing = await tx
        .select({ productId: stockOpnameLines.productId })
        .from(stockOpnameLines)
        .where(eq(stockOpnameLines.opnameId, header.opnameId));
      const allowed = new Set(existing.map((row) => row.productId));
      for (const line of input.lines) {
        if (!allowed.has(line.product_id)) {
          throw new BadRequestException({
            code: "OPNAME_INVALID",
            message: "Produk tidak ada pada opname ini.",
          });
        }
        await tx
          .update(stockOpnameLines)
          .set({ countedQty: line.counted_qty })
          .where(
            and(
              eq(stockOpnameLines.opnameId, header.opnameId),
              eq(stockOpnameLines.productId, line.product_id),
            ),
          );
      }
    });
    return this.get(opnameId);
  }

  async approve(opnameId: string, actorId?: string): Promise<OpnameDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lockDraft(tx, opnameId);
      const lines = await tx
        .select()
        .from(stockOpnameLines)
        .where(eq(stockOpnameLines.opnameId, header.opnameId));
      if (lines.some((line) => line.countedQty == null)) {
        throw new BadRequestException({
          code: "OPNAME_INVALID",
          message: "Semua produk harus dihitung sebelum disetujui.",
        });
      }

      const productIds = lines.map((line) => line.productId);
      const productRows = await tx
        .select()
        .from(products)
        .where(inArray(products.productId, productIds))
        .for("update");
      const productById = new Map(productRows.map((row) => [row.productId, row]));

      const sums = await tx
        .select({
          productId: stockMovements.productId,
          qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.storeId, STORE_1_ID),
            eq(stockMovements.bucket, "sellable"),
            inArray(stockMovements.productId, productIds),
          ),
        )
        .groupBy(stockMovements.productId);
      const currentByProduct = new Map(
        sums.map((row) => [row.productId, toQty(row.qty)]),
      );

      const parsed = applyOpname({
        lines: lines.map((line) => ({
          product_id: line.productId,
          counted_qty: line.countedQty as number,
          current_qty: currentByProduct.get(line.productId) ?? 0,
        })),
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }

      for (const adj of parsed.adjustments) {
        const existing = productById.get(adj.product_id);
        if (!existing) {
          throw new NotFoundException({
            code: "CATALOG_NOT_FOUND",
            message: "Produk tidak ditemukan.",
          });
        }
        if (adj.qty_delta !== 0) {
          await insertStockMovement(tx, {
            productId: adj.product_id,
            storeId: STORE_1_ID,
            qtyDelta: adj.qty_delta,
            bucket: "sellable",
            reason: "opname stok",
            sourceType: "opname",
            sourceId: header.opnameId,
            actorId: actorId ?? null,
          });
        }
        await tx
          .update(products)
          .set({
            stockQty: adj.counted_qty,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, adj.product_id));
      }

      await tx
        .update(stockOpnames)
        .set({
          status: "approved",
          decidedBy: actorId ?? null,
          decidedAt: new Date(),
        })
        .where(eq(stockOpnames.opnameId, header.opnameId));
    });
    return this.get(opnameId);
  }

  async reject(opnameId: string, actorId?: string): Promise<OpnameDetail> {
    return this.closeDraft(opnameId, "rejected", actorId);
  }

  async cancel(opnameId: string, actorId?: string): Promise<OpnameDetail> {
    return this.closeDraft(opnameId, "cancelled", actorId);
  }

  private async closeDraft(
    opnameId: string,
    status: "rejected" | "cancelled",
    actorId?: string,
  ): Promise<OpnameDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lockDraft(tx, opnameId);
      await tx
        .update(stockOpnames)
        .set({
          status,
          decidedBy: actorId ?? null,
          decidedAt: new Date(),
        })
        .where(eq(stockOpnames.opnameId, header.opnameId));
    });
    return this.get(opnameId);
  }

  private async lockDraft(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    opnameId: string,
  ) {
    const rows = await tx
      .select()
      .from(stockOpnames)
      .where(eq(stockOpnames.opnameId, opnameId))
      .limit(1)
      .for("update");
    const header = rows[0];
    if (!header) {
      throw new NotFoundException({
        code: "OPNAME_NOT_FOUND",
        message: "Opname tidak ditemukan.",
      });
    }
    if (header.status !== "draft") {
      throw new BadRequestException({
        code: "OPNAME_NOT_DRAFT",
        message: "Opname ini sudah tidak bisa diubah.",
      });
    }
    return header;
  }

  private async loadDetail(opnameId: string): Promise<OpnameDetail | null> {
    const db = getDb();
    const headers = await db
      .select()
      .from(stockOpnames)
      .where(eq(stockOpnames.opnameId, opnameId))
      .limit(1);
    const header = headers[0];
    if (!header) return null;

    const rows = await db
      .select({
        productId: stockOpnameLines.productId,
        systemQty: stockOpnameLines.systemQty,
        countedQty: stockOpnameLines.countedQty,
        name: products.name,
        sku: products.sku,
      })
      .from(stockOpnameLines)
      .innerJoin(products, eq(products.productId, stockOpnameLines.productId))
      .where(eq(stockOpnameLines.opnameId, opnameId));

    const lines: OpnameLine[] = rows.map((row) => ({
      product_id: row.productId,
      name: row.name,
      sku: row.sku ?? null,
      system_qty: row.systemQty,
      counted_qty: row.countedQty,
      variance:
        row.countedQty == null ? null : row.countedQty - row.systemQty,
    }));

    return {
      opname_id: header.opnameId,
      store_id: header.storeId,
      status: header.status,
      created_at: header.createdAt.toISOString(),
      decided_at: header.decidedAt?.toISOString() ?? null,
      lines,
    };
  }
}
