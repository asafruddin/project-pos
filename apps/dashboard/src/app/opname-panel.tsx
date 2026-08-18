"use client";

import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  OpnameListResponse,
  OpnameStatus,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

function statusLabel(status: OpnameStatus): string {
  if (status === "draft") return "Draf";
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  return "Dibatalkan";
}

export function OpnamePanel({
  canMutate = true,
}: {
  canMutate?: boolean;
  canApprove?: boolean;
}) {
  const [list, setList] = useState<OpnameListResponse["opnames"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    setLoading(true);
    try {
      const opRes = await authorizedFetch("/inventory/opnames");
      const opData = (await opRes.json()) as OpnameListResponse | ApiErrorBody;
      if (!opRes.ok) {
        setError((opData as ApiErrorBody).message ?? "Gagal memuat opname.");
        return;
      }
      setError(null);
      setList((opData as OpnameListResponse).opnames);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar opname
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat opname…" : `${list.length} opname`}
          </p>
        </div>
        {canMutate ? <CreateLink href="/opname/new">Tambah opname</CreateLink> : null}
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
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada opname.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {list.map((item) => (
              <li
                key={item.opname_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">
                  {statusLabel(item.status)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.product_count} produk
                </p>
                <div className="mt-3">
                  <RowLink href={`/opname/${item.opname_id}`}>Buka</RowLink>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Produk</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => (
                    <tr
                      key={item.opname_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {statusLabel(item.status)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.product_count} produk
                      </td>
                      <td className="px-4 py-3">
                        <RowLink href={`/opname/${item.opname_id}`}>Buka</RowLink>
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
