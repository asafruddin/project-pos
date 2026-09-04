"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableSkeleton,
} from "@pos-apps/ui/molecules";
import { Button, Input } from "@pos-apps/ui/atoms";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  GitBranchIcon,
  ImageSquareIcon,
  ListIcon,
  PencilSimpleIcon,
  PlusIcon,
  SquaresFourIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Product, ProductListResponse } from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { fetchAllCatalogProducts } from "@/lib/fetch-all-catalog";
import { formatIdr } from "@/lib/format-money";

type StockFilter = "all" | "in-stock" | "low" | "out";
type SortKey = "name" | "price-low" | "price-high" | "stock-low" | "newest";
type ViewMode = "list" | "grid";

const PAGE_SIZE = 20;

function ProductImage({
  product,
  className = "size-12",
}: {
  product: Product;
  className?: string;
}) {
  const image =
    product.images.find((item) => item.is_primary) ?? product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.secure_url}
      alt={product.name}
      className={`rounded-xl object-cover ring-1 ring-border/70 ${className}`}
    />
  ) : (
    <div
      className={`flex items-center justify-center rounded-xl bg-secondary text-muted-foreground ring-1 ring-border/70 ${className}`}
      aria-label="Belum ada gambar"
    >
      <ImageSquareIcon size={22} />
    </div>
  );
}

function StatusBadge({ status }: { status: Product["status"] }) {
  const active = status !== "inactive";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {active ? <CheckCircleIcon size={14} weight="fill" /> : <XCircleIcon size={14} />}
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function StockBadge({ product }: { product: Product }) {
  const out = product.stock_qty <= 0;
  const low = !out && product.min_qty != null && product.stock_qty <= product.min_qty;
  const tone = out
    ? "bg-red-500/10 text-red-700 dark:text-red-300"
    : low
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {out || low ? <WarningCircleIcon size={14} weight="fill" /> : <CheckCircleIcon size={14} weight="fill" />}
      {out ? "Habis" : low ? "Rendah" : "Tersedia"}
    </span>
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAllCatalogProducts((pageNum, limit) =>
      catalogRequest<ProductListResponse>(
        `/catalog/products?page=${pageNum}&limit=${limit}`,
      ),
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setProducts(result.products);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products.map((p) => p.category_name).filter(Boolean) as string[],
        ),
      ].sort(),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products
      .filter((p) => {
        const haystack = [
          p.name,
          p.sku,
          p.barcode,
          p.category_name,
          p.brand_name,
          p.unit_name,
          ...p.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesStock =
          stock === "all" ||
          (stock === "out"
            ? p.stock_qty === 0
            : stock === "low"
              ? p.min_qty != null && p.stock_qty <= p.min_qty
              : p.stock_qty > 0);
        return (
          (!normalized || haystack.includes(normalized)) &&
          (status === "all" || p.status === status) &&
          (category === "all" || p.category_name === category) &&
          matchesStock
        );
      })
      .sort((a, b) => {
        const tie =
          a.name.localeCompare(b.name) ||
          a.product_id.localeCompare(b.product_id);
        if (sort === "price-low") return a.price_minor - b.price_minor || tie;
        if (sort === "price-high") return b.price_minor - a.price_minor || tie;
        if (sort === "stock-low") return a.stock_qty - b.stock_qty || tie;
        if (sort === "newest")
          return (b.created_at ?? "").localeCompare(a.created_at ?? "") || tie;
        return tie;
      });
  }, [category, products, query, sort, status, stock]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const pagedProducts = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return visibleProducts.slice(start, start + PAGE_SIZE);
  }, [visibleProducts, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, status, category, stock, sort]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function displayName(p: Product): string {
    if (!p.parent_id) return p.name;
    const parent = products.find((row) => row.product_id === p.parent_id);
    return parent ? `${parent.name} · ${p.name}` : p.name;
  }

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setStock("all");
    setSort("name");
    setPage(1);
  }

  const hasFilters = Boolean(
    query || status !== "all" || category !== "all" || stock !== "all",
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar produk
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Memuat katalog…"
              : `${visibleProducts.length} dari ${products.length} produk`}
          </p>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products/import"
              scroll={false}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-90"
            >
              Impor
            </Link>
            <Link
              href="/products/new"
              scroll={false}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <PlusIcon size={18} weight="bold" />
              Tambah produk
            </Link>
          </div>
        ) : null}
      </div>
      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {!loading && products.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_9rem_12rem_10rem_12rem]">
            <label>
              <span className="sr-only">Cari produk</span>
              <Input
                type="search"
                placeholder="Cari nama, SKU, merek…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10"
              />
            </label>
            <Select
              value={status}
              onValueChange={setStatus}
            >
              <SelectTrigger aria-label="Filter status" className="h-10">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Filter kategori" className="h-10">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stock}
              onValueChange={(value) => setStock(value as StockFilter)}
            >
              <SelectTrigger aria-label="Filter stok" className="h-10">
                <SelectValue placeholder="Semua stok" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua stok</SelectItem>
                <SelectItem value="in-stock">Ada stok</SelectItem>
                <SelectItem value="low">Stok rendah</SelectItem>
                <SelectItem value="out">Stok habis</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <SelectTrigger aria-label="Urutkan produk" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nama A–Z</SelectItem>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="price-low">Harga terendah</SelectItem>
                <SelectItem value="price-high">Harga tertinggi</SelectItem>
                <SelectItem value="stock-low">Stok terendah</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <XIcon size={14} />
                Reset filter
              </button>
            ) : (
              <span />
            )}
            <div
              className="inline-flex rounded-lg border border-border p-0.5"
              role="group"
              aria-label="Tampilan produk"
            >
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon-sm"
                aria-pressed={viewMode === "list"}
                aria-label="Tampilan daftar"
                title="Tampilan daftar"
                onClick={() => setViewMode("list")}
              >
                <ListIcon size={18} />
              </Button>
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon-sm"
                aria-pressed={viewMode === "grid"}
                aria-label="Tampilan grid"
                title="Tampilan grid"
                onClick={() => setViewMode("grid")}
              >
                <SquaresFourIcon size={18} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {loading ? (
        <TableSkeleton rows={7} />
      ) : products.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada produk. Tambahkan produk pertama untuk mulai mengisi
            katalog.
          </p>
          {canMutate ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/products/import"
                scroll={false}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:opacity-90"
              >
                Impor
              </Link>
              <Link
                href="/products/new"
                scroll={false}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <PlusIcon size={18} weight="bold" />
                Tambah produk
              </Link>
            </div>
          ) : null}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <p className="font-medium text-foreground">Produk tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Coba ubah kata kunci atau filter yang dipilih.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Reset filter
          </button>
        </div>
      ) : (
        <div className="flex min-h-[30rem] flex-1 flex-col gap-4">
          {viewMode === "grid" ? (
            <ul className="grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pagedProducts.map((p) => (
                <li
                  key={p.product_id}
                  className="group flex min-h-56 flex-col rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <ProductImage product={p} className="size-16" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                          {displayName(p)}
                        </p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">
                        {p.category_name || "Tanpa kategori"} · {p.sku || "Tanpa SKU"}
                      </p>
                      <p className="mt-3 text-base font-semibold text-foreground">
                        {formatIdr(p.price_minor)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Stok saat ini</p>
                      <p className="mt-0.5 font-semibold text-foreground">
                        {p.stock_qty} {p.unit_name || "unit"}
                      </p>
                    </div>
                    <StockBadge product={p} />
                  </div>
                  {canMutate ? (
                    <div className="mt-3 flex gap-2 border-t border-border/70 pt-3">
                      <Link
                        href={`/products/${p.product_id}/edit`}
                        scroll={false}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <PencilSimpleIcon size={15} />
                        Ubah
                      </Link>
                      <Link
                        href={`/products/new?parentId=${p.product_id}`}
                        scroll={false}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <GitBranchIcon size={15} />
                        Varian
                      </Link>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <ul className="grid flex-1 content-start gap-3 sm:hidden">
                {pagedProducts.map((p) => (
                  <li
                    key={p.product_id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex items-center gap-3">
                      <ProductImage product={p} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 font-semibold leading-snug text-foreground">
                            {displayName(p)}
                          </p>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {p.category_name || "Tanpa kategori"}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {formatIdr(p.price_minor)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.stock_qty} {p.unit_name || "unit"} tersedia
                        </p>
                      </div>
                      <StockBadge product={p} />
                    </div>
                    {canMutate ? (
                      <div className="mt-3 flex gap-2 border-t border-border/70 pt-3">
                        <Link
                          href={`/products/${p.product_id}/edit`}
                          scroll={false}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <PencilSimpleIcon size={15} />
                          Ubah
                        </Link>
                        <Link
                          href={`/products/new?parentId=${p.product_id}`}
                          scroll={false}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <GitBranchIcon size={15} />
                          Varian
                        </Link>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="hidden flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                    <thead className="bg-secondary/50">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-4 py-3.5 font-medium">Produk</th>
                        <th className="px-4 py-3.5 font-medium">Kategori / SKU</th>
                        <th className="px-4 py-3.5 font-medium">Satuan</th>
                        <th className="px-4 py-3.5 font-medium">Status</th>
                        <th className="px-4 py-3.5 font-medium">Harga</th>
                        <th className="px-4 py-3.5 font-medium">Stok</th>
                        <th className="px-4 py-3.5 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedProducts.map((p) => (
                        <tr
                          key={p.product_id}
                          className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <ProductImage product={p} />
                              <div>
                                <p className="truncate font-semibold text-foreground">{displayName(p)}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {p.brand_name || "Tanpa merek"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            <p>{p.category_name || "Tanpa kategori"}</p>
                            <p className="mt-0.5 text-xs">
                              {p.sku || "Tanpa SKU"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            {p.unit_name || "—"}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-foreground">
                            {formatIdr(p.price_minor)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col items-start gap-1.5">
                              <span className="font-semibold text-foreground">
                                {p.stock_qty} {p.unit_name || "unit"}
                              </span>
                              <StockBadge product={p} />
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {canMutate ? (
                              <div className="flex gap-2">
                                <Link
                                  href={`/products/${p.product_id}/edit`}
                                  scroll={false}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <PencilSimpleIcon size={15} />
                                  Ubah
                                </Link>
                                <Link
                                  href={`/products/new?parentId=${p.product_id}`}
                                  scroll={false}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <GitBranchIcon size={15} />
                                  Varian
                                </Link>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          <div className="mt-auto flex w-full flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Menampilkan {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, visibleProducts.length)} dari{" "}
              {visibleProducts.length}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 sm:flex-none"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="min-w-28 text-center text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 sm:flex-none"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
