"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  ReturnDetail,
  ReturnListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
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
  canLinkExchange,
}: {
  canRefund: boolean;
  canLinkExchange: boolean;
}) {
  const [open, setOpen] = useState<ReturnDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [exchangeId, setExchangeId] = useState<Record<string, string>>({});

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

  async function refund(row: ReturnDetail) {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/sales/returns/${row.return_id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_minor: row.amount_minor }),
      });
      const data = (await res.json()) as ReturnDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal refund.");
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function linkExchange(e: FormEvent, row: ReturnDetail) {
    e.preventDefault();
    const id = exchangeId[row.return_id]?.trim();
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        `/sales/returns/${row.return_id}/exchange`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exchange_sale_id: id }),
        },
      );
      const data = (await res.json()) as ReturnDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal tautkan tukar.");
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

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
          Kasir tidak dapat refund. Admin katalog menekan Refund tunai di sini.
        </p>
      ) : null}
      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada retur menunggu refund.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((row) => (
            <li key={row.return_id} className="rounded-md border border-border p-4">
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
              ) : canLinkExchange ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(e) => void linkExchange(e, row)}
                >
                  <input
                    className="min-h-12 min-w-[12rem] flex-1 rounded-md border border-border bg-background px-3 text-sm"
                    placeholder="ID penjualan tukar"
                    value={exchangeId[row.return_id] ?? ""}
                    onChange={(e) =>
                      setExchangeId((current) => ({
                        ...current,
                        [row.return_id]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="submit"
                    disabled={pending}
                    className="min-h-12 rounded-md bg-secondary text-secondary-foreground"
                  >
                    Tautkan tukar
                  </Button>
                </form>
              ) : null}
              {canRefund ? (
                <Button
                  type="button"
                  disabled={pending}
                  className="mt-3 min-h-12 rounded-md bg-accent text-accent-foreground"
                  onClick={() => void refund(row)}
                >
                  Refund tunai {formatIdr(row.amount_minor)}
                </Button>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Menunggu refund manajer.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
