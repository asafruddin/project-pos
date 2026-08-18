import type { Product } from "@pos-apps/types";
import {
  openLocalDb,
  type CatalogImageRecord,
  type CatalogProductRecord,
} from "./db.js";
import {
  syncCatalogImageCache,
  type ImageBytesFetcher,
} from "./catalog-images.js";

export type { CatalogImageRecord, CatalogProductRecord };
export { primaryCatalogImage, syncCatalogImageCache } from "./catalog-images.js";

const META_CATALOG_PULLED_AT = "catalogPulledAt";

export function isSellableCatalogRow(
  product: CatalogProductRecord,
  all: CatalogProductRecord[],
): boolean {
  const status = product.status ?? "active";
  if (status !== "active") return false;
  return !all.some((other) => other.parentId === product.productId);
}

export async function listCatalogProducts(): Promise<CatalogProductRecord[]> {
  const db = await openLocalDb();
  const rows = await db.getAll("catalogProducts");
  const sellable = rows.filter((row) => isSellableCatalogRow(row, rows));
  const byId = new Map(sellable.map((row) => [row.productId, row]));
  const enriched = sellable.map((product) => {
    if (!product.unitConversion) return product;
    const pack = byId.get(product.unitConversion.fromProductId);
    if (!pack || pack.stockQty === product.unitConversion.fromStockQty) {
      return product;
    }
    return {
      ...product,
      unitConversion: {
        ...product.unitConversion,
        fromStockQty: pack.stockQty,
      },
    };
  });
  return enriched.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function getCatalogPulledAt(): Promise<string | null> {
  const db = await openLocalDb();
  return (await db.get("meta", META_CATALOG_PULLED_AT)) ?? null;
}

/**
 * Replace local catalog with a full pull from server products (AD-9).
 * Clears previous rows so deleted server products disappear locally.
 */
export async function replaceCatalog(products: Product[]): Promise<number> {
  const db = await openLocalDb();
  const pulledAt = new Date().toISOString();
  const tx = db.transaction(["catalogProducts", "meta"], "readwrite");
  await tx.objectStore("catalogProducts").clear();
  for (const p of products) {
    const conversion = p.unit_conversion
      ? {
          fromProductId: p.unit_conversion.from_product_id,
          fromProductName: p.unit_conversion.from_product_name,
          fromUnitName: p.unit_conversion.from_unit_name ?? null,
          fromStockQty: p.unit_conversion.from_stock_qty,
          fromQty: p.unit_conversion.from_qty,
          toQty: p.unit_conversion.to_qty,
        }
      : null;
    const row: CatalogProductRecord = {
      productId: p.product_id,
      name: p.name,
      priceMinor: p.price_minor,
      stockQty: p.stock_qty,
      status: p.status ?? "active",
      parentId: p.parent_id ?? null,
      sku: p.sku ?? null,
      categoryName: p.category_name ?? null,
      unitName: p.unit_name ?? null,
      unitConversion: conversion,
      pulledAt,
    };
    await tx.objectStore("catalogProducts").put(row);
  }
  await tx.objectStore("meta").put(pulledAt, META_CATALOG_PULLED_AT);
  await tx.done;
  return products.length;
}

export async function cacheCatalogImages(
  products: Product[],
  fetchBytes: ImageBytesFetcher,
): Promise<void> {
  const db = await openLocalDb();
  await syncCatalogImageCache(
    products,
    {
      list: () => db.getAll("catalogImages"),
      put: async (row) => {
        await db.put("catalogImages", row);
      },
      delete: async (productId) => {
        await db.delete("catalogImages", productId);
      },
    },
    fetchBytes,
  );
}

export async function getCatalogImageRecord(
  productId: string,
): Promise<CatalogImageRecord | undefined> {
  const db = await openLocalDb();
  return db.get("catalogImages", productId);
}

/** Patch stock (and conversion.fromStockQty mirrors) in place after unpack. */
export async function patchCatalogStocks(
  updates: Array<{ productId: string; stockQty: number }>,
): Promise<void> {
  const db = await openLocalDb();
  const tx = db.transaction("catalogProducts", "readwrite");
  const store = tx.objectStore("catalogProducts");
  const byId = new Map(updates.map((u) => [u.productId, u.stockQty]));

  for (const [productId, stockQty] of byId) {
    const row = await store.get(productId);
    if (!row) continue;
    await store.put({ ...row, stockQty });
  }

  const all = await store.getAll();
  for (const row of all) {
    if (!row.unitConversion) continue;
    const packQty = byId.get(row.unitConversion.fromProductId);
    if (packQty === undefined) continue;
    if (row.unitConversion.fromStockQty === packQty) continue;
    await store.put({
      ...row,
      unitConversion: {
        ...row.unitConversion,
        fromStockQty: packQty,
      },
    });
  }
  await tx.done;
}

export function isValidSellablePrice(priceMinor: number): boolean {
  return Number.isInteger(priceMinor) && priceMinor >= 0;
}
