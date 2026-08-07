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
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-primary">
          {canMutate
            ? editingId
              ? "Ubah produk"
              : "Tambah produk"
            : "Katalog (hanya lihat)"}
        </h2>
        {!canMutate ? (
          <p className="max-w-md text-sm text-muted-foreground">
            Akun kasir hanya dapat melihat produk. Perubahan katalog memerlukan
            peran admin katalog.
          </p>
        ) : null}
        {canMutate ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:max-w-md">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nama produk</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Harga (Rp)</Label>
            <Input
              id="price"
              inputMode="numeric"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stock">Stok</Label>
            <Input
              id="stock"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) =>
                setForm((f) => ({ ...f, stock: e.target.value }))
              }
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                className="bg-transparent text-foreground ring-1 ring-border"
                onClick={resetForm}
              >
                Batal
              </Button>
            ) : null}
          </div>
        </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-primary">Daftar produk</h2>
        {loading ? (
          <p className="text-muted-foreground">Memuat…</p>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground">
            Belum ada produk. Tambahkan produk pertama untuk mulai mengisi
            katalog.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Nama</th>
                  <th className="py-2 pr-4 font-medium">Harga</th>
                  <th className="py-2 pr-4 font-medium">Stok</th>
                  <th className="py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">{formatIdr(p.price_minor)}</td>
                    <td className="py-2 pr-4">{p.stock_qty}</td>
                    <td className="py-2">
                      {canMutate ? (
                      <Button
                        type="button"
                        className="h-8 bg-transparent px-3 text-foreground ring-1 ring-border"
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
        )}
      </section>
    </div>
  );
}
