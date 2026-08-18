"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody, StoreListResponse, StoreRecord } from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StoresPanel({ canEdit }: { canEdit: boolean }) {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [registers, setRegisters] = useState<StoreListResponse["registers"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storeRes = await authorizedFetch("/stores");
      const storeData = (await storeRes.json()) as StoreListResponse | ApiErrorBody;
      if (!storeRes.ok) {
        setError(errorMessage(storeRes, storeData));
        return;
      }
      const packed = storeData as StoreListResponse;
      setStores(packed.stores);
      setRegisters(packed.registers);
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

  function registerLabel(storeId: string): string {
    return (
      registers
        .filter((row) => row.store_id === storeId)
        .map((row) => row.name)
        .join(", ") || "tanpa register"
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar toko
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${stores.length} toko`}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <RowLink href="/stores/prices">Harga toko</RowLink>
            <CreateLink href="/stores/new">Tambah toko</CreateLink>
          </div>
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
        <TableSkeleton rows={5} />
      ) : stores.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada toko.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {stores.map((store) => (
              <li
                key={store.store_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">
                  {store.name}
                  {store.store_id === STORE_1_ID ? " · Store #1" : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {registerLabel(store.store_id)}
                </p>
                {canEdit ? (
                  <div className="mt-3">
                    <RowLink href={`/stores/${store.store_id}/registers/new`}>
                      Tambah register
                    </RowLink>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Toko</th>
                    <th className="px-4 py-3 font-medium">Register</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr
                      key={store.store_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {store.name}
                        {store.store_id === STORE_1_ID ? (
                          <span className="ml-1 text-muted-foreground">· Store #1</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {registerLabel(store.store_id)}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <RowLink href={`/stores/${store.store_id}/registers/new`}>
                            Tambah register
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
