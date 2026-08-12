"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  Product,
  ProductListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSession, getAccessToken } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type FormState = {
  name: string;
  price: string;
  stock: string;
};

const emptyForm: FormState = { name: "", price: "", stock: "" };

function parseNonNegInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function ProductsPanel({ canMutate }: { canMutate: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const forceLogin = useCallback(() => {
    clearSession();
    router.replace("/login");
  }, [router]);

  const api = useCallback(
    async <T,>(
      path: string,
      init?: RequestInit,
    ): Promise<{ ok: true; data: T } | { ok: false; message: string }> => {
      const token = getAccessToken();
      if (!token) {
        forceLogin();
        return { ok: false, message: "Sesi tidak ditemukan. Masuk lagi." };
      }
      try {
        const res = await fetch(`${API_URL}${path}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {}),
          },
        });
        const data = (await res.json()) as T | ApiErrorBody;
        if (res.status === 401) {
          forceLogin();
          const err = data as ApiErrorBody;
          return {
            ok: false,
            message: err.message ?? "Sesi berakhir. Masuk lagi.",
          };
        }
        if (!res.ok) {
          const err = data as ApiErrorBody;
          return { ok: false, message: err.message ?? "Permintaan gagal." };
        }
        return { ok: true, data: data as T };
      } catch {
        return { ok: false, message: "Tidak dapat menghubungi API." };
      }
    },
    [forceLogin],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api<ProductListResponse>("/catalog/products");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setProducts(result.data.products);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(p: Product) {
    setEditingId(p.product_id);
    setForm({
      name: p.name,
      price: String(p.price_minor),
      stock: String(p.stock_qty),
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const price_minor = parseNonNegInt(form.price);
    const stock_qty = parseNonNegInt(form.stock);
    if (!form.name.trim() || price_minor === null || stock_qty === null) {
      setError("Nama, harga, dan stok harus valid (bilangan bulat ≥ 0).");
      setPending(false);
      return;
    }

    if (editingId) {
      const updated = await api<Product>(`/catalog/products/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: form.name.trim(), price_minor }),
      });
      if (!updated.ok) {
        setError(updated.message);
        setPending(false);
        await load();
        return;
      }
      const stocked = await api<Product>(
        `/catalog/products/${editingId}/stock`,
        {
          method: "PUT",
          body: JSON.stringify({ stock_qty }),
        },
      );
      if (!stocked.ok) {
        setError(stocked.message);
        setPending(false);
        await load();
        return;
      }
    } else {
      const created = await api<Product>("/catalog/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          price_minor,
          stock_qty,
        }),
      });
      if (!created.ok) {
        setError(created.message);
        setPending(false);
        return;
      }
    }

    setPending(false);
    resetForm();
    await load();
  }

  return (
    <div className="flex w-full flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-background/70 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {canMutate
              ? editingId
                ? "Ubah produk"
                : "Tambah produk"
              : "Katalog (hanya lihat)"}
          </h2>
          {!canMutate ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Akun kasir hanya dapat melihat produk. Perubahan katalog
              memerlukan peran admin katalog.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {editingId
                ? "Perbarui nama, harga, atau stok lalu simpan."
                : "Isi form untuk menambah produk baru ke katalog."}
            </p>
          )}
        </div>

        {canMutate ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nama produk</Label>
              <Input
                id="name"
                placeholder="contoh: Espresso"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                disabled={pending}
                className="h-12 min-h-12"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Harga (Rp)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  placeholder="15000"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  required
                  disabled={pending}
                  className="h-12 min-h-12"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  inputMode="numeric"
                  placeholder="10"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock: e.target.value }))
                  }
                  required
                  disabled={pending}
                  className="h-12 min-h-12"
                />
              </div>
            </div>
            {error ? (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={pending}
                className="h-12 min-h-12 min-w-28"
              >
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  className="h-12 min-h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={resetForm}
                  disabled={pending}
                >
                  Batal
                </Button>
              ) : null}
            </div>
          </form>
        ) : error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Daftar produk
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Memuat…" : `${products.length} produk`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-sm text-muted-foreground">
            Memuat katalog…
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-sm text-muted-foreground">
            Belum ada produk. Tambahkan produk pertama untuk mulai mengisi
            katalog.
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {products.map((p) => (
                <li
                  key={p.product_id}
                  className="rounded-xl border border-border bg-background/70 p-4"
                >
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatIdr(p.price_minor)} · Stok {p.stock_qty}
                  </p>
                  {canMutate ? (
                    <Button
                      type="button"
                      className="mt-3 h-10 bg-secondary px-3 text-secondary-foreground hover:opacity-90"
                      onClick={() => startEdit(p)}
                    >
                      Ubah
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-xl border border-border bg-background/70 sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Nama</th>
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
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3">
                          {formatIdr(p.price_minor)}
                        </td>
                        <td className="px-4 py-3">{p.stock_qty}</td>
                        <td className="px-4 py-3">
                          {canMutate ? (
                            <Button
                              type="button"
                              className="h-9 bg-secondary px-3 text-secondary-foreground hover:opacity-90"
                              onClick={() => startEdit(p)}
                            >
                              Ubah
                            </Button>
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
      </section>
    </div>
  );
}
