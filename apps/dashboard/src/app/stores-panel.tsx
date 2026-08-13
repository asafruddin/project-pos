"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  ProductListResponse,
  StoreListResponse,
  StoreRecord,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StoresPanel({ canEdit }: { canEdit: boolean }) {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [registers, setRegisters] = useState<StoreListResponse["registers"]>([]);
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [name, setName] = useState("");
  const [registerStore, setRegisterStore] = useState(STORE_1_ID);
  const [registerName, setRegisterName] = useState("Register 2");
  const [priceStore, setPriceStore] = useState(STORE_1_ID);
  const [priceProduct, setPriceProduct] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      setRegisters(packed.registers);
      if (catalogRes.ok) {
        setProducts(((await catalogRes.json()) as ProductListResponse).products);
      }
      setError(null);
    } catch {
      setError("Gagal memuat toko.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreateStore(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    try {
      const res = await authorizedFetch("/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setName("");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function onCreateRegister(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    try {
      const res = await authorizedFetch("/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: registerStore, name: registerName }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function onSetPrice(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !priceProduct) return;
    setPending(true);
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
      setPrice("");
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="text-sm">
        {stores.map((store) => (
          <li key={store.store_id} className="py-1">
            <span className="font-medium">{store.name}</span>
            {store.store_id === STORE_1_ID ? " · Store #1" : ""}
            <span className="text-muted-foreground">
              {" "}
              ·{" "}
              {registers
                .filter((row) => row.store_id === store.store_id)
                .map((row) => row.name)
                .join(", ") || "tanpa register"}
            </span>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => void onCreateStore(e)}>
            <div>
              <Label htmlFor="store-name">Toko baru</Label>
              <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending} className="self-end h-12">
              Tambah toko
            </Button>
          </form>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => void onCreateRegister(e)}>
            <div>
              <Label htmlFor="reg-store">Register di toko</Label>
              <select
                id="reg-store"
                className="flex h-12 rounded-lg border border-border bg-background px-3 text-sm"
                value={registerStore}
                onChange={(e) => setRegisterStore(e.target.value)}
              >
                {stores.map((store) => (
                  <option key={store.store_id} value={store.store_id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="reg-name">Nama register</Label>
              <Input id="reg-name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending} className="self-end h-12">
              Tambah register
            </Button>
          </form>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => void onSetPrice(e)}>
            <div>
              <Label htmlFor="price-store">Harga toko</Label>
              <select
                id="price-store"
                className="flex h-12 rounded-lg border border-border bg-background px-3 text-sm"
                value={priceStore}
                onChange={(e) => setPriceStore(e.target.value)}
              >
                {stores.map((store) => (
                  <option key={store.store_id} value={store.store_id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="price-product">Produk</Label>
              <select
                id="price-product"
                className="flex h-12 min-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm"
                value={priceProduct}
                onChange={(e) => setPriceProduct(e.target.value)}
              >
                <option value="">Pilih</option>
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="price-minor">Harga (kosong = katalog)</Label>
              <Input id="price-minor" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending} className="self-end h-12">
              Simpan harga
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
