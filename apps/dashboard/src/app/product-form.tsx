"use client";

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { Product, ProductImage, ProductListResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogRequest } from "@/lib/catalog-request";
import { formatIdr } from "@/lib/format-money";
import { cn } from "@/lib/utils";

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

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-background/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

const inputClass = "h-10 min-h-10";

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
  const [parentName, setParentName] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    parentId: parentId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId || parentId));

  const loadCatalog = useCallback(async () => {
    const result = await catalogRequest<ProductListResponse>("/catalog/products");
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return null;
    }
    return result.data.products;
  }, []);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const products = await loadCatalog();
    setLoading(false);
    if (!products) return;
    const found = products.find((row) => row.product_id === productId);
    if (!found) {
      setError("Produk tidak ditemukan.");
      return;
    }
    setProduct(found);
    setForm(formFromProduct(found));
    if (found.parent_id) {
      const parent = products.find((row) => row.product_id === found.parent_id);
      setParentName(parent?.name ?? null);
    }
    setError(null);
  }, [loadCatalog, productId]);

  useEffect(() => {
    if (productId) {
      void loadProduct();
      return;
    }
    if (!parentId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const products = await loadCatalog();
      setLoading(false);
      if (!products) return;
      const parent = products.find((row) => row.product_id === parentId);
      if (parent) {
        setParentName(parent.name);
        setForm((f) => ({
          ...f,
          parentId,
          category: parent.category_name ?? f.category,
          brand: parent.brand_name ?? f.brand,
          trackStock: parent.track_stock ?? f.trackStock,
        }));
      }
    })();
  }, [loadCatalog, loadProduct, parentId, productId]);

  const editingId = productId ?? null;
  const editingImages = product?.images ?? [];
  const pricePreview = parseNonNegInt(form.price);

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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex min-h-full flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          scroll={false}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon size={16} />
          Daftar produk
        </Link>
        {form.parentId ? (
          <p className="rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            Varian
            {parentName ? (
              <>
                {" "}
                dari <span className="font-medium text-foreground">{parentName}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="flex flex-col gap-4">
          <Section
            title="Produk"
            description="Nama yang tampil di kasir. SKU dan barcode opsional."
          >
            <Field id="name" label="Nama" required>
              <Input
                id="name"
                placeholder="contoh: Espresso"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                disabled={pending}
                className={inputClass}
              />
            </Field>
            <Field id="description" label="Deskripsi" hint="Opsional. Tampil di katalog, bukan di Checkout.">
              <textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={pending}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="sku" label="SKU">
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
              <Field id="barcode" label="Barcode">
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barcode: e.target.value }))
                  }
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="category" label="Kategori">
                <Input
                  id="category"
                  placeholder="contoh: Minuman"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
              <Field id="brand" label="Merek">
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field id="tags" label="Tag" hint="Pisahkan dengan koma.">
              <Input
                id="tags"
                placeholder="kopi, hot, signature"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                disabled={pending}
                className={inputClass}
              />
            </Field>
          </Section>

          {editingId ? (
            <Section
              title="Gambar"
              description="Gambar utama dipakai kasir setelah menyegarkan menu."
            >
              {form.status === "active" && !product?.has_primary_image ? (
                <p
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                  role="status"
                >
                  Produk aktif tanpa gambar utama. Kasir tetap bisa menjual.
                </p>
              ) : null}
              <label
                htmlFor="productImage"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-secondary/50"
              >
                <span className="font-medium text-foreground">Unggah gambar</span>
                <span className="mt-1 text-xs">JPEG, PNG, WebP, atau GIF</span>
                <input
                  id="productImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={pending}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onUploadImage(file);
                  }}
                />
              </label>
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
                      <p className="min-w-0 flex-1 text-sm font-medium">
                        {image.is_primary ? "Utama" : "Galeri"}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          className="h-8 bg-secondary px-2 text-xs text-secondary-foreground hover:opacity-90"
                          disabled={pending || index === 0}
                          onClick={() => void onMoveImage(image.image_id, -1)}
                        >
                          Naik
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-secondary px-2 text-xs text-secondary-foreground hover:opacity-90"
                          disabled={pending || index === editingImages.length - 1}
                          onClick={() => void onMoveImage(image.image_id, 1)}
                        >
                          Turun
                        </Button>
                        {!image.is_primary ? (
                          <Button
                            type="button"
                            className="h-8 bg-secondary px-2 text-xs text-secondary-foreground hover:opacity-90"
                            disabled={pending}
                            onClick={() => void onSetPrimary(image.image_id)}
                          >
                            Utama
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          className="h-8 bg-secondary px-2 text-xs text-secondary-foreground hover:opacity-90"
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
            </Section>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Section
            title="Harga"
            description="Angka utuh Rupiah. 15000 = Rp15.000."
          >
            <Field
              id="price"
              label="Harga jual"
              required
              hint={
                pricePreview != null ? `Tampil sebagai ${formatIdr(pricePreview)}` : undefined
              }
            >
              <Input
                id="price"
                inputMode="numeric"
                placeholder="15000"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
                disabled={pending}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cost" label="Harga modal">
                <Input
                  id="cost"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
              <Field id="compareAt" label="Harga banding">
                <Input
                  id="compareAt"
                  inputMode="numeric"
                  value={form.compareAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, compareAt: e.target.value }))
                  }
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <Section title="Stok" description="Kasir tetap bisa menjual meski stok habis.">
            <Field id="stock" label="Jumlah" required>
              <Input
                id="stock"
                inputMode="numeric"
                placeholder="10"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                required
                disabled={pending}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2.5 text-sm">
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
              Lacak stok di buku besar
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="minQty" label="Stok min" hint="Tandai rendah di ikhtisar.">
                <Input
                  id="minQty"
                  inputMode="numeric"
                  value={form.minQty}
                  onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
              <Field id="maxQty" label="Stok max">
                <Input
                  id="maxQty"
                  inputMode="numeric"
                  value={form.maxQty}
                  onChange={(e) => setForm((f) => ({ ...f, maxQty: e.target.value }))}
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            </div>
            {editingId ? (
              <Field
                id="reason"
                label="Alasan ubah stok"
                hint="Wajib hanya jika jumlah stok berubah."
              >
                <Input
                  id="reason"
                  placeholder="contoh: koreksi hitung"
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  disabled={pending}
                  className={inputClass}
                />
              </Field>
            ) : null}
          </Section>

          <Section title="Status">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setForm((f) => ({ ...f, status: "active" }))}
                className={cn(
                  "h-10 rounded-md text-sm font-medium transition-colors",
                  form.status === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:opacity-90",
                )}
              >
                Aktif
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setForm((f) => ({ ...f, status: "inactive" }))}
                className={cn(
                  "h-10 rounded-md text-sm font-medium transition-colors",
                  form.status === "inactive"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:opacity-90",
                )}
              >
                Nonaktif
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Produk nonaktif tetap di katalog Dashboard, tersembunyi dari menu kasir.
            </p>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-2 border-t border-border bg-card/95 py-3 backdrop-blur">
        {error ? (
          <p className="w-full text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
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
  );
}
