"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  StockOverviewItem,
  StockOverviewResponse,
  StoreListResponse,
  StoreRecord,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

type Filter = "all" | "low" | "out" | "damaged";

function matchesFilter(row: StockOverviewItem, filter: Filter): boolean {
  if (filter === "low") return row.is_low;
  if (filter === "out") return row.is_out;
  if (filter === "damaged") return row.damaged_qty > 0;
  return true;
}

export function StockOverviewPanel({ canMutate }: { canMutate: boolean }) {
  const [rows, setRows] = useState<StockOverviewItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [storeId, setStoreId] = useState(STORE_1_ID);
  const [stores, setStores] = useState<StoreRecord[]>([]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    setLoading(true);
    try {
      const storesRes = await authorizedFetch("/stores");
      if (storesRes.ok) {
        setStores(((await storesRes.json()) as StoreListResponse).stores);
      }
      const qs = storeId ? `?store_id=${encodeURIComponent(storeId)}` : "";
      const res = await authorizedFetch(`/inventory/overview${qs}`);
      const data = (await res.json()) as StockOverviewResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat ikhtisar stok.");
        setLoading(false);
        return;
      }
      setError(null);
      setRows((data as StockOverviewResponse).products);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((row) => matchesFilter(row, filter));

  async function onMarkDamaged(e: FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) {
      setError("Jumlah rusak harus bilangan bulat ≥ 1.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan wajib saat memindah ke rusak.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const qs = storeId ? `?store_id=${encodeURIComponent(storeId)}` : "";
      const res = await authorizedFetch(`/inventory/products/${targetId}/damaged${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: n, reason: reason.trim() }),
      });
      const data = (await res.json()) as StockOverviewItem | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memindah stok.");
        setPending(false);
        return;
      }
      setTargetId(null);
      setQty("");
      setReason("");
      await load();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Semua" },
    { id: "low", label: "Rendah" },
    { id: "out", label: "Habis" },
    { id: "damaged", label: "Ada rusak" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        {stores.length > 1 ? (
          <div>
            <Label htmlFor="overview-store">Toko</Label>
            <select
              id="overview-store"
              className="flex h-10 rounded-lg border border-border bg-background px-3 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map((store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name}
                  {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {filters.map((item) => (
          <Button
            key={item.id}
            type="button"
            className={
              filter === item.id
                ? "h-10"
                : "h-10 bg-secondary text-secondary-foreground hover:opacity-90"
            }
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {canMutate && targetId ? (
        <form
          onSubmit={(e) => void onMarkDamaged(e)}
          className="flex max-w-md flex-col gap-3 rounded-xl border border-border p-4"
        >
          <p className="font-medium">
            Pindah ke rusak —{" "}
            {rows.find((row) => row.product_id === targetId)?.name}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dmgQty">Jumlah</Label>
            <Input
              id="dmgQty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dmgReason">Alasan</Label>
            <Input
              id="dmgReason"
              placeholder="contoh: pecah saat kirim"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-12">
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button
              type="button"
              className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
              onClick={() => {
                setTargetId(null);
                setQty("");
                setReason("");
              }}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat ikhtisar stok…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada produk pada filter ini.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Dijual</th>
                <th className="px-4 py-3 font-medium">Rusak</th>
                <th className="px-4 py-3 font-medium">Transit</th>
                <th className="px-4 py-3 font-medium">Min</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.product_id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.sellable_qty}</td>
                  <td className="px-4 py-3">{row.damaged_qty}</td>
                  <td className="px-4 py-3">{row.in_transit_qty}</td>
                  <td className="px-4 py-3">{row.min_qty ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.is_out || row.is_low ? (
                      <span className="flex flex-wrap gap-1">
                        {row.is_out ? (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                            Habis
                          </span>
                        ) : null}
                        {row.is_low && !row.is_out ? (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-foreground">
                            Rendah
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canMutate ? (
                      <Button
                        type="button"
                        className="h-9 bg-secondary px-3 text-secondary-foreground hover:opacity-90"
                        onClick={() => {
                          setTargetId(row.product_id);
                          setError(null);
                        }}
                      >
                        Pindah ke rusak
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
    </div>
  );
}
