"use client";

import { Button } from "@pos-apps/ui/atoms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  StockTransfer,
  StockTransferListResponse,
  StockTransferStatus,
  StoreListResponse,
  StoreRecord,
} from "@pos-apps/types";
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
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [storeRes, transferRes] = await Promise.all([
        authorizedFetch("/stores"),
        authorizedFetch("/transfers"),
      ]);
      if (storeRes.ok) {
        const packed = (await storeRes.json()) as StoreListResponse;
        setStores(packed.stores);
      }
      if (!transferRes.ok) {
        setError(errorMessage(transferRes, await transferRes.json().catch(() => ({}))));
        return;
      }
      setTransfers(((await transferRes.json()) as StockTransferListResponse).transfers);
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

  function canShowNext(row: StockTransfer, next: StockTransferStatus): boolean {
    return next === "approved" ||
      next === "preparing" ||
      next === "shipped" ||
      next === "received" ||
      next === "completed"
      ? canApprove
      : canAdvance;
  }

  function Actions({ row }: { row: StockTransfer }) {
    const next = NEXT[row.status];
    return (
      <div className="flex flex-wrap gap-2">
        {next && canShowNext(row, next) ? (
          <Button
            type="button"
            className="h-9"
            disabled={pending}
            onClick={() => void advance(row, next)}
          >
            Lanjut ke {next}
          </Button>
        ) : null}
        {row.status === "draft" ||
        row.status === "requested" ||
        row.status === "approved" ? (
          <Button
            type="button"
            className="h-9 bg-secondary text-secondary-foreground"
            disabled={pending || !canAdvance}
            onClick={() => void advance(row, "cancelled")}
          >
            Batalkan
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar transfer
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${transfers.length} transfer`}
          </p>
        </div>
        {canCreate ? (
          <CreateLink href="/transfers/new">Tambah transfer</CreateLink>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : transfers.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada transfer.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {transfers.map((row) => (
              <li
                key={row.transfer_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">
                  {storeName(row.from_store_id)} → {storeName(row.to_store_id)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.status} ·{" "}
                  {row.lines
                    .map((line) => `${line.name ?? line.product_id} ×${line.qty}`)
                    .join(", ")}
                </p>
                <div className="mt-3">
                  <Actions row={row} />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Rute</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((row) => (
                    <tr
                      key={row.transfer_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {storeName(row.from_store_id)} → {storeName(row.to_store_id)}
                      </td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.lines
                          .map(
                            (line) =>
                              `${line.name ?? line.product_id} ×${line.qty}`,
                          )
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <Actions row={row} />
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
