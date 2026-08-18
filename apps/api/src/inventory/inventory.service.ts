import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { markDamaged, unpackUnit } from "@pos-apps/domain";
import {
  STORE_1_ID,
  type StockOverviewItem,
  type StockOverviewResponse,
  type UnpackUnitResponse,
} from "@pos-apps/types";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, productUnitConversions, stockMovements } from "../db/schema";
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

  private async sellableQty(
    tx: {
      select: (...args: never[]) => {
        from: (table: typeof stockMovements) => {
          where: (cond: unknown) => Promise<Array<{ qty: string }>>;
        };
      };
    },
    storeId: string,
    productId: string,
    store1Projection: number,
  ): Promise<number> {
    if (storeId === STORE_1_ID) return store1Projection;
    const sums = await tx
      .select({
        qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
      } as never)
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          eq(stockMovements.bucket, "sellable"),
          eq(stockMovements.productId, productId),
        ),
      );
    return toQty(sums[0]?.qty);
  }

  /**
   * Unpack pack SKU into pcs SKU immediately (AD-4 UnpackUnit).
   * `:toProductId` is the pcs (destination) product.
   */
  async unpack(
    toProductId: string,
    input: { pack_qty?: number },
    actorId?: string,
    storeId?: string,
  ): Promise<UnpackUnitResponse> {
    const movementStore = storeId || STORE_1_ID;
    const packQty = input.pack_qty ?? 1;

    return getDb().transaction(async (tx) => {
      const conversionRows = await tx
        .select()
        .from(productUnitConversions)
        .where(eq(productUnitConversions.toProductId, toProductId))
        .limit(1);
      const conversion = conversionRows[0];
      if (!conversion) {
        throw new BadRequestException({
          code: "UNPACK_INVALID",
          message: "Produk tidak memiliki konversi kemasan.",
        });
      }

      const locked = await tx
        .select()
        .from(products)
        .where(
          inArray(products.productId, [
            conversion.fromProductId,
            conversion.toProductId,
          ]),
        )
        .for("update");
      const byId = new Map(locked.map((row) => [row.productId, row]));
      const fromProduct = byId.get(conversion.fromProductId);
      const toProduct = byId.get(conversion.toProductId);
      if (!fromProduct || !toProduct) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }

      const fromSellable = await this.sellableQty(
        tx as never,
        movementStore,
        fromProduct.productId,
        fromProduct.stockQty,
      );
      const toSellable = await this.sellableQty(
        tx as never,
        movementStore,
        toProduct.productId,
        toProduct.stockQty,
      );

      const parsed = unpackUnit({
        pack_qty: packQty,
        from_qty: conversion.fromQty,
        to_qty: conversion.toQty,
        from_stock_qty: fromSellable,
        from_track_stock: fromProduct.trackStock,
        to_track_stock: toProduct.trackStock,
        from_status: fromProduct.status,
        to_status: toProduct.status,
        from_product_id: fromProduct.productId,
        to_product_id: toProduct.productId,
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }

      const sourceId = randomUUID();
      await insertStockMovement(tx, {
        productId: fromProduct.productId,
        storeId: movementStore,
        qtyDelta: parsed.from_delta,
        bucket: "sellable",
        reason: "unpack",
        sourceType: "unpack",
        sourceId,
        actorId: actorId ?? null,
      });
      await insertStockMovement(tx, {
        productId: toProduct.productId,
        storeId: movementStore,
        qtyDelta: parsed.to_delta,
        bucket: "sellable",
        reason: "unpack",
        sourceType: "unpack",
        sourceId,
        actorId: actorId ?? null,
      });

      const fromStockQty = fromSellable + parsed.from_delta;
      const toStockQty = toSellable + parsed.to_delta;
      if (movementStore === STORE_1_ID) {
        await tx
          .update(products)
          .set({ stockQty: fromStockQty, updatedAt: new Date() })
          .where(eq(products.productId, fromProduct.productId));
        await tx
          .update(products)
          .set({ stockQty: toStockQty, updatedAt: new Date() })
          .where(eq(products.productId, toProduct.productId));
      }

      return {
        from_product_id: fromProduct.productId,
        to_product_id: toProduct.productId,
        from_stock_qty: fromStockQty,
        to_stock_qty: toStockQty,
        from_delta: parsed.from_delta,
        to_delta: parsed.to_delta,
      };
    });
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
