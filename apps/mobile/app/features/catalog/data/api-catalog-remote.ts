import type { Product, ProductListResponse, UnpackUnitResponse } from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";
import type { CatalogProduct } from "../domain/product";
import type { CatalogRemote, ProductImageRef, UnpackRemote } from "../domain/ports";

const PAGE_LIMIT = 100;

export function toCatalogProduct(p: Product): CatalogProduct {
  const c = p.unit_conversion;
  return {
    productId: p.product_id,
    name: p.name,
    priceMinor: p.price_minor,
    stockQty: p.stock_qty,
    status: p.status ?? "active",
    parentId: p.parent_id ?? null,
    sku: p.sku ?? null,
    categoryName: p.category_name ?? null,
    unitName: p.unit_name ?? null,
    unitConversion: c
      ? {
          fromProductId: c.from_product_id,
          fromProductName: c.from_product_name,
          fromUnitName: c.from_unit_name ?? null,
          fromStockQty: c.from_stock_qty,
          fromQty: c.from_qty,
          toQty: c.to_qty,
        }
      : null,
    trackStock: p.track_stock ?? true,
  };
}

/** The primary image (or first) of a product, if any. */
export function primaryImage(p: Product): ProductImageRef | null {
  const images = p.images ?? [];
  const img = images.find((i) => i.is_primary) ?? images[0];
  return img ? { productId: p.product_id, imageId: img.image_id } : null;
}

/** Walks paginated GET /catalog/products (same contract as the cashier PWA). */
export class ApiCatalogRemote implements CatalogRemote, UnpackRemote {
  constructor(private readonly http: HttpClient) {}

  async fetchAll(): Promise<{ products: CatalogProduct[]; images: ProductImageRef[] }> {
    const products: CatalogProduct[] = [];
    const images: ProductImageRef[] = [];
    for (let page = 1; ; page += 1) {
      const res = await this.http.request<ProductListResponse>({
        method: "GET",
        path: `/catalog/products?page=${page}&limit=${PAGE_LIMIT}`,
      });
      const rows = res.products ?? [];
      for (const p of rows) {
        products.push(toCatalogProduct(p));
        const img = primaryImage(p);
        if (img) images.push(img);
      }
      const totalPages = res.meta?.total_pages ?? 1;
      if (page >= totalPages || rows.length === 0) return { products, images };
    }
  }

  async unpack(productId: string) {
    const res = await this.http.request<UnpackUnitResponse>({
      method: "POST",
      path: `/inventory/products/${productId}/unpack`,
      body: { pack_qty: 1 },
    });
    return {
      fromProductId: res.from_product_id,
      toProductId: res.to_product_id,
      fromStockQty: res.from_stock_qty,
      toStockQty: res.to_stock_qty,
    };
  }
}
