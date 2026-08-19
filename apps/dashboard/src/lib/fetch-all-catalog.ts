import type { Product, ProductListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { catalogRequest } from "@/lib/catalog-request";

const PAGE_LIMIT = 100;

type CatalogPageFetcher = (
  page: number,
  limit: number,
) => Promise<
  { ok: true; data: ProductListResponse } | { ok: false; message: string }
>;

/** Walk paginated GET /catalog/products until every page is collected. */
export async function fetchAllCatalogProducts(
  fetchPage: CatalogPageFetcher = (page, limit) =>
    catalogRequest<ProductListResponse>(
      `/catalog/products?page=${page}&limit=${limit}`,
    ),
): Promise<{ ok: true; products: Product[] } | { ok: false; message: string }> {
  const products: Product[] = [];
  let page = 1;
  for (;;) {
    const result = await fetchPage(page, PAGE_LIMIT);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    products.push(...result.data.products);
    const totalPages = result.data.meta?.total_pages ?? 1;
    if (page >= totalPages || result.data.products.length === 0) break;
    page += 1;
  }
  return { ok: true, products };
}

/** Same as fetchAllCatalogProducts but via authorizedFetch (form dropdowns). */
export async function fetchAllCatalogProductsAuth(): Promise<
  { ok: true; products: Product[] } | { ok: false; message: string }
> {
  return fetchAllCatalogProducts(async (page, limit) => {
    try {
      const res = await authorizedFetch(
        `/catalog/products?page=${page}&limit=${limit}`,
      );
      const data = (await res.json()) as ProductListResponse & {
        message?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          message: data.message ?? `Gagal memuat katalog (${res.status})`,
        };
      }
      return { ok: true, data };
    } catch {
      return { ok: false, message: "Tidak dapat menghubungi API." };
    }
  });
}
