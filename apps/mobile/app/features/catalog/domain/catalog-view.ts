import { tracksStock, type CatalogProduct } from "./product";

export type StockFilter = "all" | "in" | "out";
export type CatalogSort = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-desc";

export const CATALOG_PAGE_SIZE = 24;

export type CatalogFilters = {
  query: string;
  category: string;
  stock: StockFilter;
  sort: CatalogSort;
  lang: "id" | "en";
};

export const defaultFilters = (lang: "id" | "en"): CatalogFilters => ({ query: "", category: "", stock: "all", sort: "name-asc", lang });

/** Filters that live in the bottom sheet (search lives in the bar). */
export function activeFilterCount(f: Pick<CatalogFilters, "category" | "stock" | "sort">): number {
  return (f.category ? 1 : 0) + (f.stock !== "all" ? 1 : 0) + (f.sort !== "name-asc" ? 1 : 0);
}

function compare(a: string, b: string, lang: "id" | "en"): number {
  return a.localeCompare(b, lang === "en" ? "en" : "id", { sensitivity: "base" });
}

export function categoriesOf(products: CatalogProduct[], lang: "id" | "en"): string[] {
  const set = new Set<string>();
  for (const p of products) if (p.categoryName?.trim()) set.add(p.categoryName.trim());
  return [...set].sort((a, b) => compare(a, b, lang));
}

/** Port of the PWA menu's `filterAndSortProducts`. */
export function filterAndSort(products: CatalogProduct[], f: CatalogFilters): CatalogProduct[] {
  const q = f.query.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (f.category && (p.categoryName ?? "") !== f.category) return false;
    if (f.stock === "in" && tracksStock(p) && p.stockQty <= 0) return false;
    if (f.stock === "out" && (!tracksStock(p) || p.stockQty > 0)) return false;
    if (!q) return true;
    return `${p.name} ${p.sku ?? ""} ${p.unitName ?? ""}`.toLowerCase().includes(q);
  });
  return filtered.sort((a, b) => {
    switch (f.sort) {
      case "name-desc":
        return compare(b.name, a.name, f.lang);
      case "price-asc":
        return a.priceMinor - b.priceMinor || compare(a.name, b.name, f.lang);
      case "price-desc":
        return b.priceMinor - a.priceMinor || compare(a.name, b.name, f.lang);
      case "stock-desc":
        return b.stockQty - a.stockQty || compare(a.name, b.name, f.lang);
      default:
        return compare(a.name, b.name, f.lang);
    }
  });
}

export function paginate<T>(items: T[], page: number, pageSize = CATALOG_PAGE_SIZE): { rows: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safe = Math.min(Math.max(1, page), totalPages);
  return { rows: items.slice((safe - 1) * pageSize, safe * pageSize), page: safe, totalPages };
}
