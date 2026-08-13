import type { Product, ProductImage } from "@pos-apps/types";
import type { CatalogImageRecord } from "./db.js";

export type { CatalogImageRecord };

export const MAX_CACHED_IMAGE_BYTES = 2 * 1024 * 1024;

export function primaryCatalogImage(product: Product): ProductImage | null {
  const images = product.images ?? [];
  return images.find((image) => image.is_primary) ?? images[0] ?? null;
}

export type ImageCacheStore = {
  list(): Promise<CatalogImageRecord[]>;
  put(row: CatalogImageRecord): Promise<void>;
  delete(productId: string): Promise<void>;
};

export type ImageBytesFetcher = (
  productId: string,
  image: ProductImage,
) => Promise<{ mimeType: string; bytes: ArrayBuffer } | null>;

/**
 * Best-effort durable cache of primary image bytes (AD-9 / FR-41).
 * Fetch failures keep any previous row; missing images never throw.
 */
export async function syncCatalogImageCache(
  products: Product[],
  store: ImageCacheStore,
  fetchBytes: ImageBytesFetcher,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  const existing = await store.list();
  const byProduct = new Map(existing.map((row) => [row.productId, row]));
  const incomingIds = new Set(products.map((product) => product.product_id));

  for (const product of products) {
    const image = primaryCatalogImage(product);
    if (!image) {
      if (byProduct.has(product.product_id)) {
        await store.delete(product.product_id);
      }
      continue;
    }
    const cached = byProduct.get(product.product_id);
    if (cached?.publicId === image.public_id) continue;
    const fetched = await fetchBytes(product.product_id, image);
    if (!fetched) continue;
    if (fetched.bytes.byteLength > MAX_CACHED_IMAGE_BYTES) continue;
    await store.put({
      productId: product.product_id,
      publicId: image.public_id,
      mimeType: fetched.mimeType,
      bytes: fetched.bytes,
      cachedAt: now(),
    });
  }

  for (const row of existing) {
    if (!incomingIds.has(row.productId)) {
      await store.delete(row.productId);
    }
  }
}
