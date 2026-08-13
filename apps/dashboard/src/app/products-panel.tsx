"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react";
import type { Product, ProductListResponse } from "@pos-apps/types";
import { TableSkeleton } from "@/components/ui/skeleton";
import { catalogRequest } from "@/lib/catalog-request";
import { formatIdr } from "@/lib/format-money";
import { cn } from "@/lib/utils";

export function ProductsPanel({ canMutate }: { canMutate: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await catalogRequest<ProductListResponse>("/catalog/products");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setProducts(result.data.products);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function displayName(p: Product): string {
    if (!p.parent_id) return p.name;
    const parent = products.find((row) => row.product_id === p.parent_id);
    return parent ? `${parent.name} · ${p.name}` : p.name;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar produk
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat katalog…" : `${products.length} produk`}
          </p>
        </div>
        {canMutate ? (
          <Link
            href="/products/new"
            scroll={false}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
            )}
          >
            <PlusIcon size={18} weight="bold" />
            Tambah produk
          </Link>
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

      {loading ? (
        <TableSkeleton rows={7} />
      ) : products.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada produk. Tambahkan produk pertama untuk mulai mengisi katalog.
          </p>
          {canMutate ? (
            <Link
              href="/products/new"
              scroll={false}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <PlusIcon size={18} weight="bold" />
              Tambah produk
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {products.map((p) => (
              <li
                key={p.product_id}
                className="rounded-md border border-border bg-background/70 p-4"
              >
                <p className="font-medium text-foreground">{displayName(p)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatIdr(p.price_minor)} · Stok {p.stock_qty}
                  {p.status === "inactive" ? " · Nonaktif" : ""}
                </p>
                {canMutate ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/products/${p.product_id}/edit`}
                      scroll={false}
                      className="inline-flex h-10 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90"
                    >
                      Ubah
                    </Link>
                    <Link
                      href={`/products/new?parentId=${p.product_id}`}
                      scroll={false}
                      className="inline-flex h-10 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90"
                    >
                      Tambah varian
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-md border border-border bg-background/70 sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Harga</th>
                    <th className="px-4 py-3 font-medium">Stok</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.product_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{displayName(p)}</td>
                      <td className="px-4 py-3">
                        {p.status === "inactive" ? "Nonaktif" : "Aktif"}
                      </td>
                      <td className="px-4 py-3">{formatIdr(p.price_minor)}</td>
                      <td className="px-4 py-3">{p.stock_qty}</td>
                      <td className="px-4 py-3">
                        {canMutate ? (
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/products/${p.product_id}/edit`}
                              scroll={false}
                              className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90"
                            >
                              Ubah
                            </Link>
                            <Link
                              href={`/products/new?parentId=${p.product_id}`}
                              scroll={false}
                              className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:opacity-90"
                            >
                              Tambah varian
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
    </div>
  );
}
