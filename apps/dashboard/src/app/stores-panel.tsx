"use client";

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

  const load = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar toko
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stores.length} toko
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
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {stores.map((store) => (
          <li
            key={store.store_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>
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
            </span>
            {canEdit ? (
              <RowLink href={`/stores/${store.store_id}/registers/new`}>
                Tambah register
              </RowLink>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
