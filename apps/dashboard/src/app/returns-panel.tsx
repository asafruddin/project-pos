"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { RowLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  ReturnDetail,
  ReturnListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

function decisionLabel(decision: string): string {
  if (decision === "resellable") return "Layak jual";
  if (decision === "damaged") return "Rusak";
  return "Garansi";
}

export function ReturnsPanel({
  canRefund,
}: {
  canRefund: boolean;
  canLinkExchange: boolean;
}) {
  const [open, setOpen] = useState<ReturnDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    setLoading(true);
    try {
      const res = await authorizedFetch("/sales/returns");
      const data = (await res.json()) as ReturnListResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat retur.");
        return;
      }
      setError(null);
      setOpen((data as ReturnListResponse).returns);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat retur.");
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
            Retur menunggu
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${open.length} retur`}
          </p>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!canRefund ? (
        <p className="text-sm text-muted-foreground">
          Kasir tidak dapat refund. Admin katalog membuka Kelola pada retur.
        </p>
      ) : null}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : open.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Tidak ada retur menunggu refund.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {open.map((row) => (
              <li
                key={row.return_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">
                  {formatIdr(row.amount_minor)} · {row.reason}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Penjualan {row.sale_id}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {row.lines.map((line) => (
                    <li key={line.product_id}>
                      {line.name ?? line.product_id} ×{line.qty} ·{" "}
                      {decisionLabel(line.decision)}
                    </li>
                  ))}
                </ul>
                {row.exchange_sale_id ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tukar: {row.exchange_sale_id}
                  </p>
                ) : null}
                <div className="mt-3">
                  <RowLink href={`/returns/${row.return_id}`}>Kelola</RowLink>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Retur</th>
                    <th className="px-4 py-3 font-medium">Penjualan</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((row) => (
                    <tr
                      key={row.return_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {formatIdr(row.amount_minor)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.reason}
                          {row.exchange_sale_id
                            ? ` · tukar ${row.exchange_sale_id}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.sale_id}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.lines
                          .map(
                            (line) =>
                              `${line.name ?? line.product_id} ×${line.qty} (${decisionLabel(line.decision)})`,
                          )
                          .join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <RowLink href={`/returns/${row.return_id}`}>Kelola</RowLink>
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
