import type { Product, ProductListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

const PAGE_LIMIT = 100;

/** Walk paginated GET /catalog/products for a full offline catalog pull. */
export async function fetchAllCatalogProducts(): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  for (;;) {
    const res = await authorizedFetch(
      `/catalog/products?page=${page}&limit=${PAGE_LIMIT}`,
    );
    const data = (await res.json()) as ProductListResponse & {
      message?: string;
    };
    if (!res.ok) {
      throw Object.assign(new Error(data.message ?? "CATALOG_PULL_FAIL"), {
        status: res.status,
        body: data,
      });
    }
    products.push(...(data.products ?? []));
    const totalPages = data.meta?.total_pages ?? 1;
    if (page >= totalPages || (data.products?.length ?? 0) === 0) break;
    page += 1;
  }
  return products;
}
