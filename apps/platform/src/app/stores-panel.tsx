"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody, StoreListResponse, StoreRecord } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  const err = body as ApiErrorBody;
  return err?.message ?? `Gagal (${res.status})`;
}

export function StoresPanel() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authorizedFetch("/platform/stores");
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setStores(((await res.json()) as StoreListResponse).stores);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat toko.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar toko
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${stores.length} toko terpisah`}
          </p>
        </div>
        <CreateLink href="/stores/new">Tambah toko</CreateLink>
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
        <TableSkeleton rows={4} />
      ) : stores.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada toko.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {stores.map((row) => (
            <li
              key={row.store_id}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <p className="font-medium text-foreground">{row.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.store_id}</p>
              <div className="mt-3">
                <RowLink href={`/accounts/new?store=${row.store_id}`}>
                  Tambah akun
                </RowLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
