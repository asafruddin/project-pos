import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { markDamaged } from "@pos-apps/domain";
import {
  STORE_1_ID,
  type StockOverviewItem,
  type StockOverviewResponse,
} from "@pos-apps/types";
import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, stockMovements } from "../db/schema";
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
export class InventoryService {
  async overview(storeId?: string): Promise<StockOverviewResponse> {
    const store = storeId || STORE_1_ID;
    const rows = await getDb()
      .select({
        productId: products.productId,
        name: products.name,
        sku: products.sku,
        minQty: products.minQty,
        trackStock: products.trackStock,
      })
      .from(products)
      .orderBy(asc(products.name));

    const sums = await getDb()
      .select({
        productId: stockMovements.productId,
        bucket: stockMovements.bucket,
        qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.storeId, store))
      .groupBy(stockMovements.productId, stockMovements.bucket);

    const byKey = new Map<string, number>();
    for (const row of sums) {
      byKey.set(`${row.productId}:${row.bucket}`, toQty(row.qty));
    }

    const list: StockOverviewItem[] = rows.map((row) => {
      const sellable_qty = byKey.get(`${row.productId}:sellable`) ?? 0;
      const damaged_qty = byKey.get(`${row.productId}:damaged`) ?? 0;
      const in_transit_qty = byKey.get(`${row.productId}:in_transit`) ?? 0;
      const is_out = sellable_qty <= 0;
      const is_low = row.minQty != null && sellable_qty <= row.minQty;
      return {
        product_id: row.productId,
        name: row.name,
        sku: row.sku ?? null,
        min_qty: row.minQty,
        track_stock: row.trackStock,
        sellable_qty,
        damaged_qty,
        in_transit_qty,
        is_low,
        is_out,
      };
    });

    return { store_id: store, products: list };
  }

  async markDamaged(
    productId: string,
    input: { qty: number; reason: string },
    actorId?: string,
    storeId?: string,
  ): Promise<StockOverviewItem> {
    const parsed = markDamaged(input);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    await getDb().transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1)
        .for("update");
      const existing = rows[0];
      if (!existing) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }

      const sourceId = randomUUID();
      const movementStore = storeId || STORE_1_ID;
      await insertStockMovement(tx, {
        productId,
        storeId: movementStore,
        qtyDelta: -parsed.qty,
        bucket: "sellable",
        reason: parsed.reason,
        sourceType: "damage",
        sourceId,
        actorId: actorId ?? null,
      });
      await insertStockMovement(tx, {
        productId,
        storeId: movementStore,
        qtyDelta: parsed.qty,
        bucket: "damaged",
        reason: parsed.reason,
        sourceType: "damage",
        sourceId,
        actorId: actorId ?? null,
      });
      if (movementStore === STORE_1_ID) {
        await tx
          .update(products)
          .set({
            stockQty: existing.stockQty - parsed.qty,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, productId));
      }
    });

    const overview = await this.overview(storeId);
    const item = overview.products.find((row) => row.product_id === productId);
    if (!item) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
    return item;
  }
}
