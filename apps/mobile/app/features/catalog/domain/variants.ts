import { tracksStock, type CatalogProduct } from "./product";

export type CatalogMenuItem =
  | { kind: "product"; product: CatalogProduct }
  | {
      kind: "group";
      parent: CatalogProduct;
      variants: CatalogProduct[];
      minPriceMinor: number;
      maxPriceMinor: number;
      /** Sum of tracked variant stock; `null` when any variant is unlimited. */
      totalStockQty: number | null;
    };

/** Variants are named "Parent - Label" (dashboard); strip the parent prefix to get the label. */
export function variantDisplayLabel(variant: CatalogProduct, parent?: CatalogProduct): string {
  if (parent && variant.name.startsWith(parent.name)) {
    const rest = variant.name.slice(parent.name.length).replace(/^[\s/\-–·]+/, "");
    if (rest) return rest;
  }
  return variant.name;
}

/**
 * Collapse sellable variants under their parent (one menu item each); standalone products pass through.
 * Keeps the incoming order: a group takes the slot of its first variant. Variants of an inactive
 * parent are hidden; variants whose parent is unknown stay flat.
 */
export function groupVariants(sellable: CatalogProduct[], parents: CatalogProduct[]): CatalogMenuItem[] {
  const parentById = new Map(parents.map((p) => [p.productId, p]));
  const members = new Map<string, CatalogProduct[]>();
  const slot = new Map<string, number>();
  const items: CatalogMenuItem[] = [];

  for (const product of sellable) {
    const parent = product.parentId ? parentById.get(product.parentId) : undefined;
    if (!parent) {
      items.push({ kind: "product", product });
      continue;
    }
    if (parent.status !== "active") continue;
    const list = members.get(parent.productId);
    if (list) {
      list.push(product);
      continue;
    }
    members.set(parent.productId, [product]);
    slot.set(parent.productId, items.length);
    items.push({ kind: "product", product });
  }

  for (const [parentId, variants] of members) {
    const parent = parentById.get(parentId)!;
    const sorted = [...variants].sort((a, b) =>
      variantDisplayLabel(a, parent).localeCompare(variantDisplayLabel(b, parent), "id", { numeric: true }),
    );
    const prices = sorted.map((v) => v.priceMinor);
    items[slot.get(parentId)!] = {
      kind: "group",
      parent,
      variants: sorted,
      minPriceMinor: Math.min(...prices),
      maxPriceMinor: Math.max(...prices),
      totalStockQty: sorted.some((v) => !tracksStock(v)) ? null : sorted.reduce((n, v) => n + v.stockQty, 0),
    };
  }
  return items;
}
