"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Product, ProductImage, ProductListResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { catalogRequest } from "@/lib/catalog-request";

type FormState = {
  name: string;
  price: string;
  stock: string;
  reason: string;
  originalStock: number | null;
  sku: string;
  barcode: string;
  description: string;
  status: "active" | "inactive";
  category: string;
  brand: string;
  cost: string;
  compareAt: string;
  minQty: string;
  maxQty: string;
  tags: string;
  parentId: string;
  trackStock: boolean;
};

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

const emptyForm: FormState = {
  name: "",
  price: "",
  stock: "",
  reason: "",
  originalStock: null,
  sku: "",
  barcode: "",
  description: "",
  status: "active",
  category: "",
  brand: "",
  cost: "",
  compareAt: "",
  minQty: "",
  maxQty: "",
  tags: "",
  parentId: "",
  trackStock: true,
};

function parseNonNegInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > INT32_MAX) return null;
  return n;
}

function parseIntQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < INT32_MIN || n > INT32_MAX) return null;
  return n;
}

function formFromProduct(p: Product): FormState {
  return {
    name: p.name,
    price: String(p.price_minor),
    stock: String(p.stock_qty),
    reason: "",
    originalStock: p.stock_qty,
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    description: p.description ?? "",
    status: p.status ?? "active",
    category: p.category_name ?? "",
    brand: p.brand_name ?? "",
    cost: p.cost_minor == null ? "" : String(p.cost_minor),
    compareAt: p.compare_at_minor == null ? "" : String(p.compare_at_minor),
    minQty: p.min_qty == null ? "" : String(p.min_qty),
    maxQty: p.max_qty == null ? "" : String(p.max_qty),
    tags: (p.tags ?? []).join(", "),
    parentId: p.parent_id ?? "",
    trackStock: p.track_stock ?? true,
  };
}

export function ProductForm({
  canMutate,
  productId,
  parentId,
}: {
  canMutate: boolean;
  productId?: string;
  parentId?: string;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    parentId: parentId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const result = await catalogRequest<ProductListResponse>("/catalog/products");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const found = result.data.products.find((row) => row.product_id === productId);
    if (!found) {
      setError("Produk tidak ditemukan.");
      return;
    }
    setProduct(found);
    setForm(formFromProduct(found));
    setError(null);
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const editingId = productId ?? null;
  const editingImages = product?.images ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const price_minor = parseNonNegInt(form.price);
    const stock_qty = editingId
      ? parseIntQty(form.stock)
      : parseNonNegInt(form.stock);
    if (!form.name.trim() || price_minor === null || stock_qty === null) {
      setError(
        editingId
          ? "Nama, harga, dan stok harus bilangan bulat."
          : "Nama, harga, dan stok harus valid (bilangan bulat ≥ 0).",
      );
      setPending(false);
      return;
    }

    const catalogFields = {
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      category_name: form.category.trim() || null,
      brand_name: form.brand.trim() || null,
      cost_minor: form.cost.trim() ? parseNonNegInt(form.cost) : null,
      compare_at_minor: form.compareAt.trim()
        ? parseNonNegInt(form.compareAt)
        : null,
      min_qty: form.minQty.trim() ? parseIntQty(form.minQty) : null,
      max_qty: form.maxQty.trim() ? parseIntQty(form.maxQty) : null,
      track_stock: form.trackStock,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      parent_id: form.parentId.trim() || null,
    };
    if (form.cost.trim() && catalogFields.cost_minor === null) {
      setError("Harga modal harus bilangan bulat ≥ 0.");
      setPending(false);
      return;
    }
    if (form.compareAt.trim() && catalogFields.compare_at_minor === null) {
      setError("Harga banding harus bilangan bulat ≥ 0.");
      setPending(false);
      return;
    }
    if (form.minQty.trim() && catalogFields.min_qty === null) {
      setError("Stok min harus bilangan bulat.");
      setPending(false);
      return;
    }
    if (form.maxQty.trim() && catalogFields.max_qty === null) {
      setError("Stok max harus bilangan bulat.");
      setPending(false);
      return;
    }

    if (editingId) {
      const stockChanged = stock_qty !== form.originalStock;
      if (stockChanged) {
        if (stock_qty < 0) {
          setError("Penyesuaian stok harus bilangan bulat ≥ 0.");
          setPending(false);
          return;
        }
        if (!form.reason.trim()) {
          setError("Alasan wajib saat mengubah stok.");
          setPending(false);
          return;
        }
      }
      const updated = await catalogRequest<Product>(`/catalog/products/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          price_minor,
          ...catalogFields,
        }),
      });
      if (!updated.ok) {
        setError(updated.message);
        setPending(false);
        return;
      }
      if (stockChanged) {
        const stocked = await catalogRequest<Product>(
          `/catalog/products/${editingId}/stock`,
          {
            method: "PUT",
            body: JSON.stringify({
              stock_qty,
              reason: form.reason.trim(),
            }),
          },
        );
        if (!stocked.ok) {
          setError(stocked.message);
          setPending(false);
          return;
        }
      }
    } else {
      const created = await catalogRequest<Product>("/catalog/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          price_minor,
          stock_qty,
          ...catalogFields,
        }),
      });
      if (!created.ok) {
        setError(created.message);
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.push("/");
  }

  async function onUploadImage(file: File) {
    if (!editingId) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const result = await catalogRequest<ProductImage>(
      `/catalog/products/${editingId}/images`,
      { method: "POST", body },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await loadProduct();
  }

  async function onSetPrimary(imageId: string) {
    if (!editingId) return;
    setPending(true);
    const result = await catalogRequest<ProductImage>(
      `/catalog/products/${editingId}/images/${imageId}`,
      { method: "PATCH", body: JSON.stringify({ is_primary: true }) },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await loadProduct();
  }

  async function onDeleteImage(imageId: string) {
    if (!editingId) return;
    setPending(true);
    const result = await catalogRequest<{ deleted: true }>(
      `/catalog/products/${editingId}/images/${imageId}`,
      { method: "DELETE" },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await loadProduct();
  }

  async function onMoveImage(imageId: string, direction: -1 | 1) {
    if (!editingId) return;
    const ids = editingImages.map((image) => image.image_id);
    const index = ids.indexOf(imageId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved);
    setPending(true);
    const result = await catalogRequest<ProductImage[]>(
      `/catalog/products/${editingId}/images/reorder`,
      { method: "PATCH", body: JSON.stringify({ image_ids: reordered }) },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await loadProduct();
  }

  if (!canMutate) {
    return (
      <p className="text-sm text-muted-foreground">
        Akun kasir hanya dapat melihat produk. Perubahan katalog memerlukan peran
        admin katalog.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="max-w-xl space-y-3">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <Link
          href="/"
          scroll={false}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Daftar produk
        </Link>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {editingId ? "Ubah produk" : "Tambah produk"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {editingId
            ? "Perbarui nama, harga, atau stok lalu simpan."
            : "Isi form untuk menambah produk baru ke katalog."}
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nama produk</Label>
          <Input
            id="name"
            placeholder="contoh: Espresso"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            disabled={pending}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="price">Harga (Rp)</Label>
            <Input
              id="price"
              inputMode="numeric"
              placeholder="15000"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              required
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stock">Stok</Label>
            <Input
              id="stock"
              inputMode="numeric"
              placeholder="10"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              required
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            value={form.barcode}
            onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Deskripsi</Label>
          <Input
            id="description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            disabled={pending}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Kategori</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand">Merek</Label>
            <Input
              id="brand"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cost">Harga modal (Rp)</Label>
          <Input
            id="cost"
            inputMode="numeric"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
            disabled={pending}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="compareAt">Harga banding (Rp)</Label>
            <Input
              id="compareAt"
              inputMode="numeric"
              value={form.compareAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, compareAt: e.target.value }))
              }
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tag</Label>
            <Input
              id="tags"
              placeholder="pisahkan dengan koma"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              disabled={pending}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="minQty">Stok min</Label>
            <Input
              id="minQty"
              inputMode="numeric"
              value={form.minQty}
              onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxQty">Stok max</Label>
            <Input
              id="maxQty"
              inputMode="numeric"
              value={form.maxQty}
              onChange={(e) => setForm((f) => ({ ...f, maxQty: e.target.value }))}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as "active" | "inactive",
              }))
            }
            disabled={pending}
            className="h-12 min-h-12 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            id="trackStock"
            type="checkbox"
            checked={form.trackStock}
            onChange={(e) =>
              setForm((f) => ({ ...f, trackStock: e.target.checked }))
            }
            disabled={pending}
            className="size-4 rounded-sm"
          />
          Lacak stok
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="parentId">ID induk (varian)</Label>
          <Input
            id="parentId"
            placeholder="UUID produk induk, kosongkan jika produk biasa"
            value={form.parentId}
            onChange={(e) =>
              setForm((f) => ({ ...f, parentId: e.target.value }))
            }
            disabled={pending}
          />
        </div>
        {editingId ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="productImage">Gambar produk</Label>
            {form.status === "active" && !product?.has_primary_image ? (
              <p
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                role="status"
              >
                Produk aktif tanpa gambar utama. Kasir tetap bisa menjual.
              </p>
            ) : null}
            <Input
              id="productImage"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUploadImage(file);
              }}
            />
            {editingImages.length > 0 ? (
              <ul className="grid gap-2">
                {editingImages.map((image, index) => (
                  <li
                    key={image.image_id}
                    className="flex items-center gap-3 rounded-md border border-border p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.secure_url}
                      alt={image.alt_text ?? product?.name ?? "gambar"}
                      className="size-14 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {image.is_primary ? "Utama" : "Galeri"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        className="h-9 bg-secondary px-2 text-secondary-foreground hover:opacity-90"
                        disabled={pending || index === 0}
                        onClick={() => void onMoveImage(image.image_id, -1)}
                      >
                        Naik
                      </Button>
                      <Button
                        type="button"
                        className="h-9 bg-secondary px-2 text-secondary-foreground hover:opacity-90"
                        disabled={pending || index === editingImages.length - 1}
                        onClick={() => void onMoveImage(image.image_id, 1)}
                      >
                        Turun
                      </Button>
                      {!image.is_primary ? (
                        <Button
                          type="button"
                          className="h-9 bg-secondary px-2 text-secondary-foreground hover:opacity-90"
                          disabled={pending}
                          onClick={() => void onSetPrimary(image.image_id)}
                        >
                          Utama
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        className="h-9 bg-secondary px-2 text-secondary-foreground hover:opacity-90"
                        disabled={pending}
                        onClick={() => void onDeleteImage(image.image_id)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {editingId ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Alasan</Label>
            <Input
              id="reason"
              placeholder="contoh: koreksi hitung"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              disabled={pending}
            />
            <p className="text-sm text-muted-foreground">Wajib saat mengubah stok.</p>
          </div>
        ) : null}
        {error ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending} className="min-w-28">
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button
            type="button"
            className="bg-secondary text-secondary-foreground hover:opacity-90"
            onClick={() => router.push("/")}
            disabled={pending}
          >
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
