"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { Input, NativeSelect } from "@pos-apps/ui/atoms";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageSquareIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import type { Product, ProductListResponse } from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { formatIdr } from "@/lib/format-money";

type StockFilter = "all" | "in-stock" | "low" | "out";
type SortKey = "name" | "price-low" | "price-high" | "stock-low" | "newest";

function ProductImage({ product }: { product: Product }) {
  const image = product.images.find((item) => item.is_primary) ?? product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.secure_url} alt={product.name} className="size-12 rounded-lg object-cover" />
  ) : (
    <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-muted-foreground" aria-label="Belum ada gambar">
      <ImageSquareIcon size={22} />
    </div>
  );
}

export function ProductsPanel({ canMutate }: { canMutate: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await catalogRequest<ProductListResponse>("/catalog/products");
    setLoading(false);
    if (!result.ok) { setError(result.message); return; }
    setError(null); setProducts(result.data.products);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category_name).filter(Boolean) as string[])].sort(), [products]);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((p) => {
      const haystack = [p.name, p.sku, p.barcode, p.category_name, p.brand_name, p.unit_name, ...p.tags].filter(Boolean).join(" ").toLowerCase();
      const matchesStock = stock === "all" || (stock === "out" ? p.stock_qty === 0 : stock === "low" ? p.min_qty != null && p.stock_qty <= p.min_qty : p.stock_qty > 0);
      return (!normalized || haystack.includes(normalized)) && (status === "all" || p.status === status) && (category === "all" || p.category_name === category) && matchesStock;
    }).sort((a, b) => {
      const tie = a.name.localeCompare(b.name) || a.product_id.localeCompare(b.product_id);
      if (sort === "price-low") return a.price_minor - b.price_minor || tie;
      if (sort === "price-high") return b.price_minor - a.price_minor || tie;
      if (sort === "stock-low") return a.stock_qty - b.stock_qty || tie;
      if (sort === "newest") return (b.created_at ?? "").localeCompare(a.created_at ?? "") || tie;
      return tie;
    });
  }, [category, products, query, sort, status, stock]);

  function displayName(p: Product): string {
    if (!p.parent_id) return p.name;
    const parent = products.find((row) => row.product_id === p.parent_id);
    return parent ? `${parent.name} · ${p.name}` : p.name;
  }
  function resetFilters() { setQuery(""); setStatus("all"); setCategory("all"); setStock("all"); setSort("name"); }
  const hasFilters = Boolean(query || status !== "all" || category !== "all" || stock !== "all");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold tracking-tight text-foreground">Daftar produk</h2><p className="mt-1 text-sm text-muted-foreground">{loading ? "Memuat katalog…" : `${visibleProducts.length} dari ${products.length} produk`}</p></div>
        {canMutate ? <Link href="/products/new" scroll={false} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"><PlusIcon size={18} weight="bold" />Tambah produk</Link> : null}
      </div>
      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">{error}</div> : null}
      {!loading && products.length > 0 ? <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4"><div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_9rem_12rem_10rem_12rem]"><label><span className="sr-only">Cari produk</span><Input type="search" placeholder="Cari nama, SKU, merek…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10" /></label><NativeSelect aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></NativeSelect><NativeSelect aria-label="Filter kategori" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Semua kategori</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</NativeSelect><NativeSelect aria-label="Filter stok" value={stock} onChange={(e) => setStock(e.target.value as StockFilter)}><option value="all">Semua stok</option><option value="in-stock">Ada stok</option><option value="low">Stok rendah</option><option value="out">Stok habis</option></NativeSelect><NativeSelect aria-label="Urutkan produk" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}><option value="name">Nama A–Z</option><option value="newest">Terbaru</option><option value="price-low">Harga terendah</option><option value="price-high">Harga tertinggi</option><option value="stock-low">Stok terendah</option></NativeSelect></div>{hasFilters ? <button type="button" onClick={resetFilters} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><XIcon size={14} />Reset filter</button> : null}</div> : null}
      {loading ? <TableSkeleton rows={7} /> : products.length === 0 ? <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center"><p className="text-sm text-muted-foreground">Belum ada produk. Tambahkan produk pertama untuk mulai mengisi katalog.</p>{canMutate ? <Link href="/products/new" scroll={false} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><PlusIcon size={18} weight="bold" />Tambah produk</Link> : null}</div> : visibleProducts.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-12 text-center"><p className="font-medium text-foreground">Produk tidak ditemukan</p><p className="mt-1 text-sm text-muted-foreground">Coba ubah kata kunci atau filter yang dipilih.</p><button type="button" onClick={resetFilters} className="mt-4 text-sm font-medium text-primary hover:underline">Reset filter</button></div> : <>
        <ul className="grid gap-3 sm:hidden">{visibleProducts.map((p) => <li key={p.product_id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"><div className="flex items-center gap-3"><ProductImage product={p} /><div className="min-w-0"><p className="truncate font-medium text-foreground">{displayName(p)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{p.unit_name || "Tanpa satuan"} · {p.sku || "Tanpa SKU"} · {p.category_name || "Tanpa kategori"}</p></div></div><p className="mt-3 text-sm text-muted-foreground">{formatIdr(p.price_minor)} · Stok {p.stock_qty}{p.unit_name ? ` ${p.unit_name}` : ""} · {p.status === "inactive" ? "Nonaktif" : "Aktif"}</p>{canMutate ? <div className="mt-3 flex flex-wrap gap-2"><Link href={`/products/${p.product_id}/edit`} scroll={false} className="inline-flex h-10 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90">Ubah</Link><Link href={`/products/new?parentId=${p.product_id}`} scroll={false} className="inline-flex h-10 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90">Tambah varian</Link></div> : null}</li>)}</ul>
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block"><div className="overflow-x-auto"><table className="w-full min-w-[56rem] border-collapse text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="px-4 py-3 font-medium">Produk</th><th className="px-4 py-3 font-medium">Kategori / SKU</th><th className="px-4 py-3 font-medium">Satuan</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Harga</th><th className="px-4 py-3 font-medium">Stok</th><th className="px-4 py-3 font-medium">Aksi</th></tr></thead><tbody>{visibleProducts.map((p) => <tr key={p.product_id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><div className="flex items-center gap-3"><ProductImage product={p} /><div><p className="font-medium">{displayName(p)}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.brand_name || "Tanpa merek"}</p></div></div></td><td className="px-4 py-3 text-muted-foreground"><p>{p.category_name || "Tanpa kategori"}</p><p className="mt-0.5 text-xs">{p.sku || "Tanpa SKU"}</p></td><td className="px-4 py-3 text-muted-foreground">{p.unit_name || "—"}</td><td className="px-4 py-3">{p.status === "inactive" ? "Nonaktif" : "Aktif"}</td><td className="px-4 py-3">{formatIdr(p.price_minor)}</td><td className="px-4 py-3">{p.stock_qty}{p.unit_name ? ` ${p.unit_name}` : ""}{p.min_qty != null && p.stock_qty <= p.min_qty ? <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">Rendah</span> : null}</td><td className="px-4 py-3">{canMutate ? <div className="flex flex-wrap gap-2"><Link href={`/products/${p.product_id}/edit`} scroll={false} className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90">Ubah</Link><Link href={`/products/new?parentId=${p.product_id}`} scroll={false} className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90">Varian</Link></div> : <span className="text-muted-foreground">—</span>}</td></tr>)}</tbody></table></div></div>
      </>}
    </div>
  );
}
