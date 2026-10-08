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

export function tracksCatalogStock(
  product: { trackStock?: boolean } | null | undefined,
): boolean {
  return product?.trackStock !== false;
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

/** Parent rows that have variants (containers — not sellable themselves), any status. */
export async function listCatalogVariantParents(): Promise<CatalogProductRecord[]> {
  const db = await openLocalDb();
  const rows = await db.getAll("catalogProducts");
  const parentIds = new Set(
    rows.map((r) => r.parentId).filter((id): id is string => Boolean(id)),
  );
  return rows.filter((r) => parentIds.has(r.productId));
}

export type CatalogMenuItem =
  | { kind: "product"; product: CatalogProductRecord }
  | {
      kind: "group";
      parent: CatalogProductRecord;
      variants: CatalogProductRecord[];
      /** Lowest variant price ("from Rp X"). */
      minPriceMinor: number;
      maxPriceMinor: number;
      /** Sum of tracked variant stock; `null` when any variant is untracked (unlimited). */
      totalStockQty: number | null;
    };

/** Variant display label: explicit label, else the name suffix after the parent name. */
export function variantDisplayLabel(
  variant: CatalogProductRecord,
  parent?: CatalogProductRecord,
): string {
  const label = variant.variantLabel?.trim();
  if (label) return label;
  if (parent && variant.name.startsWith(parent.name)) {
    const rest = variant.name.slice(parent.name.length).replace(/^[\s/\-–]+/, "");
    if (rest) return rest;
  }
  return variant.name;
}

/**
 * Collapse sellable variants under their parent into one menu item each;
 * standalone products pass through. Variants whose parent is missing/inactive stay flat.
 */
export function groupCatalogVariants(
  sellable: CatalogProductRecord[],
  parents: CatalogProductRecord[],
): CatalogMenuItem[] {
  const parentById = new Map(parents.map((p) => [p.productId, p]));
  const groupAt = new Map<string, number>();
  const items: CatalogMenuItem[] = [];
  const members = new Map<string, CatalogProductRecord[]>();
  for (const product of sellable) {
    const parent = product.parentId ? parentById.get(product.parentId) : undefined;
    if (!parent) {
      items.push({ kind: "product", product });
      continue;
    }
    // An inactive parent hides all of its variants from the menu.
    if ((parent.status ?? "active") !== "active") continue;
    const list = members.get(parent.productId);
    if (list) {
      list.push(product);
      continue;
    }
    members.set(parent.productId, [product]);
    // Group takes the slot of its first variant so upstream sort order is kept.
    groupAt.set(parent.productId, items.length);
    items.push({ kind: "product", product });
  }
  for (const [parentId, variants] of members) {
    const parent = parentById.get(parentId)!;
    const sorted = [...variants].sort((a, b) =>
      variantDisplayLabel(a, parent).localeCompare(variantDisplayLabel(b, parent), "id", {
        numeric: true,
      }),
    );
    const prices = sorted.map((v) => v.priceMinor);
    const untracked = sorted.some((v) => !tracksCatalogStock(v));
    items[groupAt.get(parentId)!] = {
      kind: "group",
      parent,
      variants: sorted,
      minPriceMinor: Math.min(...prices),
      maxPriceMinor: Math.max(...prices),
      totalStockQty: untracked ? null : sorted.reduce((n, v) => n + v.stockQty, 0),
    };
  }
  return items;
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
      variantLabel: p.variant_label ?? null,
      variantGroups: p.variant_groups ?? [],
      sku: p.sku ?? null,
      categoryName: p.category_name ?? null,
      unitName: p.unit_name ?? null,
      unitConversion: conversion,
      trackStock: p.track_stock ?? true,
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
