export type UnitConversion = {
  fromProductId: string;
  fromProductName: string;
  fromUnitName: string | null;
  /** Packs in stock (mirrors the pack product row). */
  fromStockQty: number;
  fromQty: number;
  toQty: number;
};

export type CatalogProduct = {
  productId: string;
  name: string;
  priceMinor: number;
  stockQty: number;
  status: "active" | "inactive";
  parentId: string | null;
  sku: string | null;
  categoryName: string | null;
  unitName: string | null;
  unitConversion: UnitConversion | null;
  /** false = unlimited stock (services, made-to-order). */
  trackStock: boolean;
};

export const tracksStock = (p: Pick<CatalogProduct, "trackStock">): boolean => p.trackStock !== false;

/** Prices must be positive whole rupiah to be sellable (PWA `isValidSellablePrice`). */
export function isValidSellablePrice(priceMinor: number): boolean {
  return Number.isInteger(priceMinor) && priceMinor > 0;
}

/** Parent products are variant containers; only leaf, active rows are sold. */
export function sellableProducts(all: CatalogProduct[]): CatalogProduct[] {
  const parentIds = new Set(all.map((p) => p.parentId).filter(Boolean));
  return all.filter((p) => p.status === "active" && !parentIds.has(p.productId));
}

/** Keep each conversion's pack stock aligned with the live pack row (port of `withLivePackStock`). */
export function withLivePackStock(products: CatalogProduct[]): CatalogProduct[] {
  const byId = new Map(products.map((p) => [p.productId, p]));
  return products.map((product) => {
    if (!product.unitConversion) return product;
    const pack = byId.get(product.unitConversion.fromProductId);
    if (!pack || pack.stockQty === product.unitConversion.fromStockQty) return product;
    return { ...product, unitConversion: { ...product.unitConversion, fromStockQty: pack.stockQty } };
  });
}

export function canOfferUnpack(product: CatalogProduct, online: boolean, catalog: CatalogProduct[]): boolean {
  if (!online || !product.unitConversion) return false;
  const pack = catalog.find((row) => row.productId === product.unitConversion!.fromProductId);
  return (pack?.stockQty ?? product.unitConversion.fromStockQty) > 0;
}
