"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toSelectValue,
  fromSelectValue,
} from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Input, Skeleton } from "@pos-apps/ui/atoms";
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
import { fetchAllCatalogProductsAuth } from "@/lib/fetch-all-catalog";
import { parseGroupedInt } from "@/lib/format-money";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function TransferForm({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [fromStore, setFromStore] = useState(STORE_1_ID);
  const [toStore, setToStore] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [storeRes, catalog] = await Promise.all([
        authorizedFetch("/stores"),
        fetchAllCatalogProductsAuth(),
      ]);
      if (storeRes.ok) {
        const packed = (await storeRes.json()) as StoreListResponse;
        setStores(packed.stores);
        setToStore((current) => {
          if (current) return current;
          const other = packed.stores.find((store) => store.store_id !== STORE_1_ID);
          return other?.store_id ?? packed.stores[1]?.store_id ?? "";
        });
      }
      if (catalog.ok) {
        setProducts(catalog.products);
      }
      setError(null);
    } catch {
      setError("Gagal memuat transfer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate || pending) return;
    if (!productId || !toStore) {
      setError("Pilih produk dan toko tujuan.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_store_id: fromStore,
          to_store_id: toStore,
          lines: [{ product_id: productId, qty: parseGroupedInt(qty) }],
        }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/transfers");
    } finally {
      setPending(false);
    }
  }

  if (!canCreate) {
    return (
      <FormDenied href="/transfers">
        Anda tidak memiliki izin untuk membuat transfer stok.
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
    <form onSubmit={(e) => void onCreate(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/transfers">Daftar transfer</FormBackLink>
      <FormSection
        title="Draf transfer"
        description="Stok baru pindah saat dikirim/diterima."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="from-store" label="Dari" required>
            <Select
              value={fromStore}
              disabled={pending}
              onValueChange={(next) => {
                setFromStore(next);
                setToStore((current) => {
                  if (current !== next) return current;
                  return stores.find((store) => store.store_id !== next)?.store_id ?? "";
                });
              }}
            >
              <SelectTrigger id="from-store">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.store_id} value={store.store_id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="to-store" label="Ke" required>
            <Select
              value={toStore}
              disabled={pending}
              onValueChange={setToStore}
            >
              <SelectTrigger id="to-store">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stores
                  .filter((store) => store.store_id !== fromStore)
                  .map((store) => (
                    <SelectItem key={store.store_id} value={store.store_id}>
                      {store.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField id="tr-product" label="Produk" required>
          <Select
            value={toSelectValue(productId)}
            disabled={pending}
            onValueChange={(value) => setProductId(fromSelectValue(value))}
          >
            <SelectTrigger id="tr-product">
              <SelectValue placeholder="Pilih" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={toSelectValue("")}>Pilih</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.product_id} value={product.product_id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="tr-qty" label="Qty" required>
          <Input
            id="tr-qty"
            inputMode="numeric"
            value={qty}
            disabled={pending}
            onChange={(e) => setQty(e.target.value)}
            className={`${formInputClass} w-24`}
          />
        </FormField>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Buat draf"
        cancelHref="/transfers"
      />
    </form>
  );
}
