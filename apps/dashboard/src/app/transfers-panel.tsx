"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  ProductListResponse,
  StockTransfer,
  StockTransferListResponse,
  StockTransferStatus,
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

const NEXT: Partial<Record<StockTransferStatus, StockTransferStatus>> = {
  draft: "requested",
  requested: "approved",
  approved: "preparing",
  preparing: "shipped",
  shipped: "received",
  received: "completed",
};

export function TransfersPanel({
  canCreate,
  canAdvance,
  canApprove,
}: {
  canCreate: boolean;
  canAdvance: boolean;
  canApprove: boolean;
}) {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [fromStore, setFromStore] = useState(STORE_1_ID);
  const [toStore, setToStore] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [storeRes, catalogRes, transferRes] = await Promise.all([
        authorizedFetch("/stores"),
        authorizedFetch("/catalog/products"),
        authorizedFetch("/transfers"),
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
      if (catalogRes.ok) {
        setProducts(((await catalogRes.json()) as ProductListResponse).products);
      }
      if (!transferRes.ok) {
        setError(errorMessage(transferRes, await transferRes.json().catch(() => ({}))));
        return;
      }
      setTransfers(((await transferRes.json()) as StockTransferListResponse).transfers);
      setError(null);
    } catch {
      setError("Gagal memuat transfer.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate || !productId || !toStore) return;
    setPending(true);
    try {
      const res = await authorizedFetch("/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_store_id: fromStore,
          to_store_id: toStore,
          lines: [{ product_id: productId, qty: Number(qty) }],
        }),
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

  async function advance(row: StockTransfer, status: StockTransferStatus) {
    const needsApprove =
      status === "approved" ||
      status === "preparing" ||
      status === "shipped" ||
      status === "received" ||
      status === "completed";
    if (needsApprove && !canApprove) return;
    if (!needsApprove && !canAdvance) return;
    setPending(true);
    try {
      const res = await authorizedFetch(`/transfers/${row.transfer_id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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

  function storeName(id: string) {
    return stores.find((store) => store.store_id === id)?.name ?? id;
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canCreate ? (
        <form className="flex flex-wrap gap-3" onSubmit={(e) => void onCreate(e)}>
          <div>
            <Label htmlFor="from-store">Dari</Label>
            <select
              id="from-store"
              className="flex h-12 rounded-lg border border-border bg-background px-3 text-sm"
              value={fromStore}
              onChange={(e) => {
                const next = e.target.value;
                setFromStore(next);
                setToStore((current) => {
                  if (current !== next) return current;
                  return stores.find((store) => store.store_id !== next)?.store_id ?? "";
                });
              }}
            >
              {stores.map((store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="to-store">Ke</Label>
            <select
              id="to-store"
              className="flex h-12 rounded-lg border border-border bg-background px-3 text-sm"
              value={toStore}
              onChange={(e) => setToStore(e.target.value)}
            >
              {stores
                .filter((store) => store.store_id !== fromStore)
                .map((store) => (
                  <option key={store.store_id} value={store.store_id}>
                    {store.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tr-product">Produk</Label>
            <select
              id="tr-product"
              className="flex h-12 min-w-[12rem] rounded-lg border border-border bg-background px-3 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
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
            <Label htmlFor="tr-qty">Qty</Label>
            <Input id="tr-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24" />
          </div>
          <Button type="submit" disabled={pending} className="self-end h-12">
            Buat draf
          </Button>
        </form>
      ) : null}

      <ul className="flex flex-col gap-3">
        {transfers.length === 0 ? (
          <li className="text-sm text-muted-foreground">Belum ada transfer.</li>
        ) : (
          transfers.map((row) => {
            const next = NEXT[row.status];
            return (
              <li key={row.transfer_id} className="rounded-2xl border border-border p-4">
                <p className="font-medium">
                  {storeName(row.from_store_id)} → {storeName(row.to_store_id)} · {row.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.lines.map((line) => `${line.name ?? line.product_id} ×${line.qty}`).join(", ")}
                </p>
                {next &&
                (next === "approved" ||
                next === "preparing" ||
                next === "shipped" ||
                next === "received" ||
                next === "completed"
                  ? canApprove
                  : canAdvance) ? (
                  <Button
                    type="button"
                    className="mt-3 h-11"
                    disabled={pending}
                    onClick={() => void advance(row, next)}
                  >
                    Lanjut ke {next}
                  </Button>
                ) : null}
                {row.status === "draft" || row.status === "requested" || row.status === "approved" ? (
                  <Button
                    type="button"
                    className="mt-3 ml-2 h-11 bg-secondary text-secondary-foreground"
                    disabled={pending || !canAdvance}
                    onClick={() => void advance(row, "cancelled")}
                  >
                    Batalkan
                  </Button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
