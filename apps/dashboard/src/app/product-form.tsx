"use client";

import { Button, Checkbox, Input, Label, NativeSelect, Skeleton, Textarea } from "@pos-apps/ui/atoms";
import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CategoryListResponse,
  Product,
  ProductImage,
  ProductListResponse,
  UnitListResponse,
} from "@pos-apps/types";
import { catalogRequest } from "@/lib/catalog-request";
import { formatIdr } from "@/lib/format-money";

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
  unit: string;
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
  unit: "",
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
    unit: p.unit_name ?? "",
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
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    parentId: parentId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId || parentId));
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [conversionEnabled, setConversionEnabled] = useState(false);
  const [conversionFromId, setConversionFromId] = useState("");
  const [conversionToQty, setConversionToQty] = useState("12");
  const [hadConversion, setHadConversion] = useState(false);

  const loadLookups = useCallback(async () => {
    const [cats, unitsRes] = await Promise.all([
      catalogRequest<CategoryListResponse>("/catalog/categories"),
      catalogRequest<UnitListResponse>("/catalog/units"),
    ]);
    if (cats.ok) {
      setCategoryOptions(cats.data.categories.map((row) => row.name));
    }
    if (unitsRes.ok) {
      setUnitOptions(unitsRes.data.units.map((row) => row.name));
    }
  }, []);

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
    const [products] = await Promise.all([loadCatalog(), loadLookups()]);
    setLoading(false);
    if (!products) return;
    setAllProducts(products);
    const found = products.find((row) => row.product_id === productId);
    if (!found) {
      setError("Produk tidak ditemukan.");
      return;
    }
    setProduct(found);
    setForm(formFromProduct(found));
    if (found.unit_conversion) {
      setConversionEnabled(true);
      setHadConversion(true);
      setConversionFromId(found.unit_conversion.from_product_id);
      setConversionToQty(String(found.unit_conversion.to_qty));
    } else {
      setConversionEnabled(false);
      setHadConversion(false);
      setConversionFromId("");
      setConversionToQty("12");
    }
    if (found.parent_id) {
      const parent = products.find((row) => row.product_id === found.parent_id);
      setParentName(parent?.name ?? null);
    }
    setError(null);
  }, [loadCatalog, loadLookups, productId]);

  useEffect(() => {
    if (productId) {
      void loadProduct();
      return;
    }
    void loadLookups();
    void (async () => {
      const products = await loadCatalog();
      if (products) setAllProducts(products);
      if (!parentId) {
        setLoading(false);
        return;
      }
      if (!products) {
        setLoading(false);
        return;
      }
      const parent = products.find((row) => row.product_id === parentId);
      if (parent) {
        setParentName(parent.name);
        setForm((f) => ({
          ...f,
          parentId,
          category: parent.category_name ?? f.category,
          brand: parent.brand_name ?? f.brand,
          unit: parent.unit_name ?? f.unit,
          trackStock: parent.track_stock ?? f.trackStock,
        }));
      }
      setLoading(false);
    })();
  }, [loadCatalog, loadLookups, loadProduct, parentId, productId]);

  const editingId = productId ?? createdProductId ?? null;
  const editingImages = product?.images ?? [];
  const pricePreview = parseNonNegInt(form.price);

  const conversionCandidates = allProducts.filter((row) => {
    if (editingId && row.product_id === editingId) return false;
    if (row.status !== "active") return false;
    if (!row.track_stock) return false;
    const sameName =
      form.name.trim() &&
      row.name.trim().toLowerCase() === form.name.trim().toLowerCase();
    const differentUnit =
      (form.unit.trim() || null) !== (row.unit_name ?? null);
    return Boolean(sameName && differentUnit);
  });

  const conversionSourceOptions = (() => {
    const byId = new Map(allProducts.map((row) => [row.product_id, row]));
    const options = [...conversionCandidates];
    if (conversionFromId && byId.has(conversionFromId)) {
      const selected = byId.get(conversionFromId)!;
      if (!options.some((row) => row.product_id === selected.product_id)) {
        options.unshift(selected);
      }
    }
    return options;
  })();

  async function saveUnitConversion(targetProductId: string): Promise<boolean> {
    if (!conversionEnabled) {
      if (hadConversion) {
        const cleared = await catalogRequest<Product>(
          `/catalog/products/${targetProductId}/unit-conversion`,
          { method: "DELETE" },
        );
        if (!cleared.ok) {
          setError(cleared.message);
          return false;
        }
      }
      return true;
    }
    const toQty = parseNonNegInt(conversionToQty);
    if (!conversionFromId || toQty === null || toQty < 1) {
      setError("Pilih produk kemasan dan isi jumlah pcs ≥ 1.");
      return false;
    }
    const saved = await catalogRequest<Product>(
      `/catalog/products/${targetProductId}/unit-conversion`,
      {
        method: "PUT",
        body: JSON.stringify({
          from_product_id: conversionFromId,
          from_qty: 1,
          to_qty: toQty,
        }),
      },
    );
    if (!saved.ok) {
      setError(saved.message);
      return false;
    }
    return true;
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function selectImage(file: File | undefined) {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

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
      unit_name: form.unit.trim() || null,
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
      if (!(await saveUnitConversion(editingId))) {
        setPending(false);
        return;
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
      setCreatedProductId(created.data.product_id);
      setProduct(created.data);
      if (selectedImage) {
        const body = new FormData();
        body.append("file", selectedImage);
        const uploaded = await catalogRequest<ProductImage>(
          `/catalog/products/${created.data.product_id}/images`,
          { method: "POST", body },
        );
        if (!uploaded.ok) {
          setError(`Produk tersimpan, tetapi gambar gagal diunggah: ${uploaded.message}`);
          setPending(false);
          return;
        }
      }
      if (!(await saveUnitConversion(created.data.product_id))) {
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.push("/products");
  }

  async function onUploadImage(file: File) {
    if (!editingId) return;
    selectImage(file);
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
      <FormDenied href="/products">
        Akun kasir hanya dapat melihat produk. Perubahan katalog memerlukan peran
        admin katalog.
      </FormDenied>
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
      className={formPageClassName}
    >
      <FormBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormBackLink href="/products">Daftar produk</FormBackLink>
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
          <FormSection
            title="Produk"
            description="Nama yang tampil di kasir. SKU dan barcode opsional."
          >
            <FormField id="name" label="Nama" required>
              <Input
                id="name"
                placeholder="contoh: Espresso"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <FormField id="description" label="Deskripsi" hint="Opsional. Tampil di katalog, bukan di Checkout.">
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={pending}
                rows={3}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="sku" label="SKU">
                <Input
                  id="sku"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
              <FormField id="barcode" label="Barcode">
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barcode: e.target.value }))
                  }
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="category" label="Kategori">
                <NativeSelect
                  id="category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  disabled={pending}
                  className={formInputClass}
                >
                  <option value="">Tanpa kategori</option>
                  {form.category && !categoryOptions.includes(form.category) ? (
                    <option value={form.category}>{form.category}</option>
                  ) : null}
                  {categoryOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="unit" label="Satuan">
                <NativeSelect
                  id="unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={pending}
                  className={formInputClass}
                >
                  <option value="">Tanpa satuan</option>
                  {form.unit && !unitOptions.includes(form.unit) ? (
                    <option value={form.unit}>{form.unit}</option>
                  ) : null}
                  {unitOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField id="brand" label="Merek">
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="conversionEnabled"
                  checked={conversionEnabled}
                  onCheckedChange={(checked) =>
                    setConversionEnabled(checked === true)
                  }
                  disabled={pending || !form.trackStock}
                />
                <Label htmlFor="conversionEnabled" className="font-normal">
                  Buka dari kemasan (Pack → pcs)
                </Label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Saat stok pcs habis, kasir dapat membuka 1 kemasan menjadi beberapa pcs.
                Simpan tautan dari produk pcs ini ke produk Pack.
              </p>
              {conversionEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FormField id="conversionFrom" label="Produk kemasan">
                    <NativeSelect
                      id="conversionFrom"
                      value={conversionFromId}
                      onChange={(e) => setConversionFromId(e.target.value)}
                      disabled={pending}
                      className={formInputClass}
                    >
                      <option value="">Pilih produk Pack…</option>
                      {conversionSourceOptions.map((row) => (
                        <option key={row.product_id} value={row.product_id}>
                          {row.name}
                          {row.unit_name ? ` (${row.unit_name})` : ""}
                          {row.sku ? ` · ${row.sku}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField
                    id="conversionToQty"
                    label="Pcs per 1 kemasan"
                    hint="Contoh: 1 Pack = 12 pcs."
                  >
                    <Input
                      id="conversionToQty"
                      inputMode="numeric"
                      value={conversionToQty}
                      onChange={(e) => setConversionToQty(e.target.value)}
                      disabled={pending}
                      className={formInputClass}
                    />
                  </FormField>
                </div>
              ) : null}
            </div>
            <FormField id="tags" label="Tag" hint="Pisahkan dengan koma.">
              <Input
                id="tags"
                placeholder="kopi, hot, signature"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
          </FormSection>

          <FormSection
              title="Gambar"
              description="Gambar utama dipakai kasir setelah menyegarkan menu. Pilih satu gambar utama saat membuat produk."
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
                <Input
                  id="productImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={pending}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      if (editingId) void onUploadImage(file);
                      else selectImage(file);
                    }
                  }}
                />
              </label>
              {imagePreview && !editingId ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-accent/40 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Pratinjau gambar produk" className="size-16 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{selectedImage?.name}</p>
                    <p className="text-xs text-muted-foreground">Gambar akan diunggah setelah produk disimpan.</p>
                  </div>
                </div>
              ) : null}
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
            </FormSection>
        </div>

        <div className="flex flex-col gap-4">
          <FormSection
            title="Harga"
            description="Angka utuh Rupiah. 15000 = Rp15.000."
          >
            <FormField
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
                className={formInputClass}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cost" label="Harga modal">
                <Input
                  id="cost"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
              <FormField id="compareAt" label="Harga banding">
                <Input
                  id="compareAt"
                  inputMode="numeric"
                  value={form.compareAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, compareAt: e.target.value }))
                  }
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Stok" description="Kasir tetap bisa menjual meski stok habis.">
            <FormField id="stock" label="Jumlah" required>
              <Input
                id="stock"
                inputMode="numeric"
                placeholder="10"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                required
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="trackStock"
                checked={form.trackStock}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, trackStock: checked === true }))
                }
                disabled={pending}
              />
              <Label htmlFor="trackStock" className="font-normal">
                Lacak stok di buku besar
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="minQty" label="Stok min" hint="Tandai rendah di ikhtisar.">
                <Input
                  id="minQty"
                  inputMode="numeric"
                  value={form.minQty}
                  onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
              <FormField id="maxQty" label="Stok max">
                <Input
                  id="maxQty"
                  inputMode="numeric"
                  value={form.maxQty}
                  onChange={(e) => setForm((f) => ({ ...f, maxQty: e.target.value }))}
                  disabled={pending}
                  className={formInputClass}
                />
              </FormField>
            </div>
            {editingId ? (
              <FormField
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
                  className={formInputClass}
                />
              </FormField>
            ) : null}
          </FormSection>

          <FormSection title="Status">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.status === "active" ? "default" : "secondary"}
                disabled={pending}
                onClick={() => setForm((f) => ({ ...f, status: "active" }))}
              >
                Aktif
              </Button>
              <Button
                type="button"
                variant={form.status === "inactive" ? "default" : "secondary"}
                disabled={pending}
                onClick={() => setForm((f) => ({ ...f, status: "inactive" }))}
              >
                Nonaktif
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Produk nonaktif tetap di katalog Dashboard, tersembunyi dari menu kasir.
            </p>
          </FormSection>
        </div>
      </div>

      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/products"
      />
    </form>
  );
}
