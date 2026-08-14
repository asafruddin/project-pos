"use client";

import { Button } from "@pos-apps/ui/atoms";
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

  const load = useCallback(async () => {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar transfer
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {transfers.length} transfer
          </p>
        </div>
        {canCreate ? (
          <CreateLink href="/transfers/new">Tambah transfer</CreateLink>
        ) : null}
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {transfers.length === 0 ? (
          <li className="text-sm text-muted-foreground">Belum ada transfer.</li>
        ) : (
          transfers.map((row) => {
            const next = NEXT[row.status];
            return (
              <li key={row.transfer_id} className="rounded-md border border-border p-4">
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
