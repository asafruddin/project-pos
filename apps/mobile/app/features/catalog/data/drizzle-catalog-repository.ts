import { asc, eq, sql } from "drizzle-orm";
import { catalogProducts } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { KvStore } from "@/infrastructure/db/kv-store";
import { sellableProducts, type CatalogProduct, type UnitConversion } from "../domain/product";
import type { CatalogRepository } from "../domain/ports";

const PULLED_AT_KEY = "catalog.pulledAt";
/** SQLite caps bound variables; insert in slices. */
const INSERT_CHUNK = 50;

function toDomain(r: typeof catalogProducts.$inferSelect): CatalogProduct {
  let unitConversion: UnitConversion | null = null;
  if (r.unitConversionJson) {
    try {
      unitConversion = JSON.parse(r.unitConversionJson) as UnitConversion;
    } catch {
      unitConversion = null;
    }
  }
  return {
    productId: r.productId,
    name: r.name,
    priceMinor: r.priceMinor,
    stockQty: r.stockQty,
    status: r.status,
    parentId: r.parentId,
    sku: r.sku,
    categoryName: r.categoryName,
    unitName: r.unitName,
    unitConversion,
    trackStock: r.trackStock,
  };
}

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(
    private readonly db: AppDb,
    private readonly kv: KvStore,
  ) {}

  replaceAll(products: CatalogProduct[], pulledAtIso: string): void {
    this.db.transaction((tx) => {
      tx.delete(catalogProducts).run();
      for (let i = 0; i < products.length; i += INSERT_CHUNK) {
        tx.insert(catalogProducts)
          .values(
            products.slice(i, i + INSERT_CHUNK).map(({ unitConversion, ...p }) => ({
              ...p,
              unitConversionJson: unitConversion ? JSON.stringify(unitConversion) : null,
              pulledAt: pulledAtIso,
            })),
          )
          .run();
      }
    });
    this.kv.set(PULLED_AT_KEY, pulledAtIso);
  }

  listSellable(): CatalogProduct[] {
    const rows = this.db
      .select()
      .from(catalogProducts)
      .orderBy(asc(sql`${catalogProducts.name} COLLATE NOCASE`))
      .all()
      .map(toDomain);
    return sellableProducts(rows);
  }

  count(): number {
    return this.db.select({ n: sql<number>`count(*)` }).from(catalogProducts).get()?.n ?? 0;
  }

  getPulledAt(): string | null {
    return this.kv.get(PULLED_AT_KEY);
  }

  getById(productId: string): CatalogProduct | null {
    const row = this.db.select().from(catalogProducts).where(eq(catalogProducts.productId, productId)).get();
    return row ? toDomain(row) : null;
  }

  patchStocks(updates: { productId: string; stockQty: number }[]): void {
    this.db.transaction((tx) => {
      for (const u of updates) {
        tx.update(catalogProducts).set({ stockQty: u.stockQty }).where(eq(catalogProducts.productId, u.productId)).run();
      }
    });
  }
}
