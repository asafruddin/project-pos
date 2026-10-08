"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody, VariantGroupListResponse, VariantGroupRecord } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function VariantsPanel({
  canCreate,
  canEdit,
}: {
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<VariantGroupRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch("/catalog/variants");
      const data = (await res.json()) as VariantGroupListResponse | ApiErrorBody;
      if (!res.ok) {
        setError(errorMessage(res, data));
        return;
      }
      setRows((data as VariantGroupListResponse).variant_groups);
      setError(null);
    } catch {
      setError("Gagal memuat varian.");
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
            Daftar varian
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${rows.length} varian`}
          </p>
        </div>
        {canCreate ? <CreateLink href="/variants/new">Tambah varian</CreateLink> : null}
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
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada varian. Buat varian (mis. Ukuran: S, M, L) lalu pilih di form produk.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {rows.map((row) => (
              <li
                key={row.variant_group_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.options.join(", ")}</p>
                {canEdit ? (
                  <div className="mt-3">
                    <RowLink href={`/variants/${row.variant_group_id}/edit`}>Ubah</RowLink>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Pilihan</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.variant_group_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.options.join(", ")}</td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <RowLink href={`/variants/${row.variant_group_id}/edit`}>Ubah</RowLink>
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
