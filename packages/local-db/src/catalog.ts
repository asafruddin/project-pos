import type { Product } from "@pos-apps/types";
import { openLocalDb, type CatalogProductRecord } from "./db.js";

export type { CatalogProductRecord };

const META_CATALOG_PULLED_AT = "catalogPulledAt";

export async function listCatalogProducts(): Promise<CatalogProductRecord[]> {
  const db = await openLocalDb();
  const rows = await db.getAll("catalogProducts");
  return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
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
    const row: CatalogProductRecord = {
      productId: p.product_id,
      name: p.name,
      priceMinor: p.price_minor,
      stockQty: p.stock_qty,
      pulledAt,
    };
    await tx.objectStore("catalogProducts").put(row);
  }
  await tx.objectStore("meta").put(pulledAt, META_CATALOG_PULLED_AT);
  await tx.done;
  return products.length;
}

export function isValidSellablePrice(priceMinor: number): boolean {
  return Number.isInteger(priceMinor) && priceMinor >= 0;
}
