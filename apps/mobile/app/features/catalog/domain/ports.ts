import type { CatalogProduct } from "./product";

export type ProductImageRef = { productId: string; imageId: string };

export interface CatalogRepository {
  /** Atomically replace the whole local catalog. */
  replaceAll(products: CatalogProduct[], pulledAtIso: string): void;
  /** Sellable products (active leaf rows), name-sorted. */
  listSellable(): CatalogProduct[];
  count(): number;
  getPulledAt(): string | null;
  getById(productId: string): CatalogProduct | null;
  /** Overwrite stock for the given products (after unpack). */
  patchStocks(updates: { productId: string; stockQty: number }[]): void;
}

export interface CatalogRemote {
  fetchAll(): Promise<{ products: CatalogProduct[]; images: ProductImageRef[] }>;
}

export interface ImageRepository {
  /** product id → cached file URI */
  uriMap(): Map<string, string>;
  get(productId: string): { imageId: string; fileUri: string } | null;
  put(row: { productId: string; imageId: string; fileUri: string; cachedAt: string }): void;
  /** Drop rows for products that are no longer in the catalog; returns removed URIs. */
  prune(keepProductIds: Set<string>): string[];
}

export interface UnpackRemote {
  unpack(productId: string): Promise<{ fromProductId: string; toProductId: string; fromStockQty: number; toStockQty: number }>;
}
