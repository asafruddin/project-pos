"use client";

import { Button, Label, NativeSelect } from "@pos-apps/ui/atoms";
import { RowLink } from "@pos-apps/ui/organisms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  StockOverviewItem,
  StockOverviewResponse,
  StoreListResponse,
  StoreRecord,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

type Filter = "all" | "low" | "out" | "damaged";

function matchesFilter(row: StockOverviewItem, filter: Filter): boolean {
  if (filter === "low") return row.is_low;
  if (filter === "out") return row.is_out;
  if (filter === "damaged") return row.damaged_qty > 0;
  return true;
}

function StatusBadges({ row }: { row: StockOverviewItem }) {
  if (!row.is_out && !row.is_low) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {row.is_out ? (
        <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
          Habis
        </span>
      ) : null}
      {row.is_low && !row.is_out ? (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
          Rendah
        </span>
      ) : null}
    </span>
  );
}

export function StockOverviewPanel({ canMutate }: { canMutate: boolean }) {
  const [rows, setRows] = useState<StockOverviewItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Semua" },
    { id: "low", label: "Rendah" },
    { id: "out", label: "Habis" },
    { id: "damaged", label: "Ada rusak" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Ikhtisar stok
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Memuat stok…"
              : `${visible.length} dari ${rows.length} produk`}
          </p>
        </div>
      </div>

      {!loading && rows.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            {stores.length > 1 ? (
              <div className="min-w-[12rem]">
                <Label htmlFor="overview-store">Toko</Label>
                <NativeSelect
                  id="overview-store"
                  className="h-10"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                >
                  {stores.map((store) => (
                    <option key={store.store_id} value={store.store_id}>
                      {store.name}
                      {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
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
          </div>
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

      {loading ? (
        <TableSkeleton rows={7} />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada data stok.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-12 text-center">
          <p className="font-medium text-foreground">Produk tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Coba ubah filter yang dipilih.
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Reset filter
          </button>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {visible.map((row) => (
              <li
                key={row.product_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dijual {row.sellable_qty} · Rusak {row.damaged_qty} · Transit{" "}
                  {row.in_transit_qty} · Min {row.min_qty ?? "—"}
                </p>
                <div className="mt-2">
                  <StatusBadges row={row} />
                </div>
                {canMutate ? (
                  <div className="mt-3">
                    <RowLink
                      href={`/stock/${row.product_id}/damage?store_id=${encodeURIComponent(storeId)}`}
                    >
                      Stok rusak
                    </RowLink>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
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
                    <tr
                      key={row.product_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{row.sellable_qty}</td>
                      <td className="px-4 py-3">{row.damaged_qty}</td>
                      <td className="px-4 py-3">{row.in_transit_qty}</td>
                      <td className="px-4 py-3">{row.min_qty ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadges row={row} />
                      </td>
                      <td className="px-4 py-3">
                        {canMutate ? (
                          <RowLink
                            href={`/stock/${row.product_id}/damage?store_id=${encodeURIComponent(storeId)}`}
                          >
                            Stok rusak
                          </RowLink>
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
    </div>
  );
}
