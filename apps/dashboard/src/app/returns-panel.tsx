"use client";

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

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
        {!canRefund ? (
          <p className="text-sm text-muted-foreground">
            Kasir tidak dapat refund. Admin katalog membuka Kelola pada retur.
          </p>
        ) : null}
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada retur menunggu refund.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((row) => (
            <li key={row.return_id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatIdr(row.amount_minor)} · {row.reason}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Penjualan {row.sale_id}
                  </p>
                  <ul className="mt-2 text-sm">
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
                </div>
                <RowLink href={`/returns/${row.return_id}`}>Kelola</RowLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
