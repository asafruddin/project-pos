import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { resolveSellingPrice } from "@pos-apps/domain";
import type {
  CreateRegisterRequest,
  CreateStoreRequest,
  RegisterRecord,
  SetStorePriceRequest,
  StoreListResponse,
  StorePrice,
  StoreRecord,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, registers, storePrices, stores } from "../db/schema";

function toStore(row: typeof stores.$inferSelect): StoreRecord {
  return {
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

function toRegister(row: typeof registers.$inferSelect): RegisterRecord {
  return {
    register_id: row.registerId,
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

@Injectable()
export class StoresService {
  async list(): Promise<StoreListResponse> {
    const db = getDb();
    const [storeRows, registerRows] = await Promise.all([
      db.select().from(stores).orderBy(asc(stores.createdAt)),
      db.select().from(registers).orderBy(asc(registers.createdAt)),
    ]);
    return {
      stores: storeRows.map(toStore),
      registers: registerRows.map(toRegister),
    };
  }

  async createStore(input: CreateStoreRequest): Promise<StoreRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama toko wajib diisi.",
      });
    }
    const db = getDb();
    return db.transaction(async (tx) => {
      const [store] = await tx
        .insert(stores)
        .values({ storeId: randomUUID(), name })
        .returning();
      if (!store) {
        throw new BadRequestException({
          code: "STORE_INVALID",
          message: "Gagal membuat toko.",
        });
      }
      await tx.insert(registers).values({
        registerId: randomUUID(),
        storeId: store.storeId,
        name: "Register 1",
      });
      return toStore(store);
    });
  }

  async createRegister(input: CreateRegisterRequest): Promise<RegisterRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama register wajib diisi.",
      });
    }
    await this.requireStore(input.store_id);
    const [row] = await getDb()
      .insert(registers)
      .values({ registerId: randomUUID(), storeId: input.store_id, name })
      .returning();
    if (!row) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Gagal membuat register.",
      });
    }
    return toRegister(row);
  }

  async setPrice(input: SetStorePriceRequest): Promise<StorePrice> {
    await this.requireStore(input.store_id);
    const product = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.productId, input.product_id))
      .limit(1);
    if (!product[0]) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
    const db = getDb();
    if (input.price_minor == null) {
      await db
        .delete(storePrices)
        .where(
          and(
            eq(storePrices.storeId, input.store_id),
            eq(storePrices.productId, input.product_id),
          ),
        );
      return {
        store_id: input.store_id,
        product_id: input.product_id,
        price_minor: null,
      };
    }
    await db
      .insert(storePrices)
      .values({
        storeId: input.store_id,
        productId: input.product_id,
        priceMinor: input.price_minor,
      })
      .onConflictDoUpdate({
        target: [storePrices.storeId, storePrices.productId],
        set: { priceMinor: input.price_minor },
      });
    return {
      store_id: input.store_id,
      product_id: input.product_id,
      price_minor: input.price_minor,
    };
  }

  async pricesForStore(storeId: string): Promise<Map<string, number>> {
    const id = storeId || STORE_1_ID;
    const rows = await getDb()
      .select()
      .from(storePrices)
      .where(eq(storePrices.storeId, id));
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.priceMinor != null) {
        map.set(row.productId, row.priceMinor);
      }
    }
    return map;
  }

  overlayCatalogPrice(catalogPrice: number, storePrice?: number | null): number {
    return resolveSellingPrice({
      catalog_price_minor: catalogPrice,
      store_price_minor: storePrice,
    });
  }

  async requireStore(storeId: string): Promise<string> {
    const rows = await getDb()
      .select({ storeId: stores.storeId })
      .from(stores)
      .where(eq(stores.storeId, storeId))
      .limit(1);
    if (!rows[0]) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Toko tidak ditemukan.",
      });
    }
    return rows[0].storeId;
  }

  async firstRegister(storeId: string): Promise<string> {
    const rows = await getDb()
      .select({ registerId: registers.registerId })
      .from(registers)
      .where(eq(registers.storeId, storeId))
      .orderBy(asc(registers.createdAt))
      .limit(1);
    return rows[0]?.registerId ?? "";
  }
}
