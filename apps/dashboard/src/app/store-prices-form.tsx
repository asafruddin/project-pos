"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Input, NativeSelect, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  ProductListResponse,
  StoreListResponse,
  StoreRecord,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StorePricesForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [priceStore, setPriceStore] = useState(STORE_1_ID);
  const [priceProduct, setPriceProduct] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [storeRes, catalogRes] = await Promise.all([
        authorizedFetch("/stores"),
        authorizedFetch("/catalog/products"),
      ]);
      const storeData = (await storeRes.json()) as StoreListResponse | ApiErrorBody;
      if (!storeRes.ok) {
        setError(errorMessage(storeRes, storeData));
        return;
      }
      const packed = storeData as StoreListResponse;
      setStores(packed.stores);
      if (catalogRes.ok) {
        setProducts(((await catalogRes.json()) as ProductListResponse).products);
      }
      setError(null);
    } catch {
      setError("Gagal memuat toko.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSetPrice(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    if (!priceProduct) {
      setError("Pilih produk.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const trimmed = price.trim();
      const res = await authorizedFetch("/stores/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: priceStore,
          product_id: priceProduct,
          price_minor: trimmed === "" ? null : Number(trimmed),
        }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/stores");
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <FormDenied href="/stores">
        Anda tidak memiliki izin untuk mengubah harga toko.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSetPrice(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/stores">Daftar toko</FormBackLink>
      <FormSection
        title="Harga toko"
        description="Kosongkan harga untuk kembali ke harga katalog. Berlaku setelah kasir menyegarkan menu."
      >
        <FormField id="price-store" label="Toko" required>
          <NativeSelect
            id="price-store"
            value={priceStore}
            disabled={pending}
            onChange={(e) => setPriceStore(e.target.value)}
          >
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="price-product" label="Produk" required>
          <NativeSelect
            id="price-product"
            value={priceProduct}
            disabled={pending}
            onChange={(e) => setPriceProduct(e.target.value)}
          >
            <option value="">Pilih</option>
            {products.map((product) => (
              <option key={product.product_id} value={product.product_id}>
                {product.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          id="price-minor"
          label="Harga (Rp)"
          hint="Kosongkan untuk memakai harga katalog."
        >
          <Input
            id="price-minor"
            inputMode="numeric"
            value={price}
            disabled={pending}
            onChange={(e) => setPrice(e.target.value)}
            className={formInputClass}
          />
        </FormField>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan harga"
        cancelHref="/stores"
      />
    </form>
  );
}
