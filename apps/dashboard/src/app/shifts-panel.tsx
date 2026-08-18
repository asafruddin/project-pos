"use client";

import { Button } from "@pos-apps/ui/atoms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody, Shift, ShiftListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ShiftsPanel() {
  const [rows, setRows] = useState<Shift[]>([]);
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
      const res = await authorizedFetch("/shifts");
      const data = (await res.json()) as ShiftListResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat shift.");
        return;
      }
      setError(null);
      setRows((data as ShiftListResponse).shifts);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat shift.");
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
            Daftar shift
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat…" : `${rows.length} shift`}
          </p>
        </div>
        <Button
          type="button"
          className="h-10 bg-secondary text-secondary-foreground hover:opacity-90"
          onClick={() => void load()}
        >
          Muat ulang
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Tutup shift mencatat selisih, tidak memaksa nol. Kasir tidak dapat mengubah
        shift tertutup.
      </p>

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
          <p className="text-sm text-muted-foreground">Belum ada shift.</p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:hidden">
            {rows.map((row) => (
              <li
                key={row.shift_id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-foreground">
                  {row.status === "open" ? "Terbuka" : "Tertutup"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatWhen(row.opened_at)} → {formatWhen(row.closed_at)} ·{" "}
                  {row.actor_login ?? "—"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Diharapkan{" "}
                  {row.expected_cash_minor == null
                    ? "—"
                    : formatIdr(row.expected_cash_minor)}{" "}
                  · Dihitung{" "}
                  {row.counted_cash_minor == null
                    ? "—"
                    : formatIdr(row.counted_cash_minor)}{" "}
                  · Selisih{" "}
                  {row.difference_minor == null
                    ? "—"
                    : formatIdr(row.difference_minor)}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Buka</th>
                    <th className="px-4 py-3 font-medium">Tutup</th>
                    <th className="px-4 py-3 font-medium">Kasir</th>
                    <th className="px-4 py-3 font-medium">Diharapkan</th>
                    <th className="px-4 py-3 font-medium">Dihitung</th>
                    <th className="px-4 py-3 font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.shift_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {row.status === "open" ? "Terbuka" : "Tertutup"}
                      </td>
                      <td className="px-4 py-3">{formatWhen(row.opened_at)}</td>
                      <td className="px-4 py-3">{formatWhen(row.closed_at)}</td>
                      <td className="px-4 py-3">{row.actor_login ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.expected_cash_minor == null
                          ? "—"
                          : formatIdr(row.expected_cash_minor)}
                      </td>
                      <td className="px-4 py-3">
                        {row.counted_cash_minor == null
                          ? "—"
                          : formatIdr(row.counted_cash_minor)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.difference_minor == null
                          ? "—"
                          : formatIdr(row.difference_minor)}
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
