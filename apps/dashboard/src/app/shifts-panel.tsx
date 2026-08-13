"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody, Shift, ShiftListResponse } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
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

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tutup shift mencatat selisih, tidak memaksa nol. Kasir tidak dapat
          mengubah shift tertutup.
        </p>
        <Button
          type="button"
          className="rounded-2xl bg-secondary text-secondary-foreground"
          onClick={() => void load()}
        >
          Muat ulang
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Buka</th>
              <th className="px-3 py-2 font-medium">Tutup</th>
              <th className="px-3 py-2 font-medium">Kasir</th>
              <th className="px-3 py-2 font-medium">Diharapkan</th>
              <th className="px-3 py-2 font-medium">Dihitung</th>
              <th className="px-3 py-2 font-medium">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={7}>
                  Belum ada shift.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.shift_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {row.status === "open" ? "Terbuka" : "Tertutup"}
                  </td>
                  <td className="px-3 py-2">{formatWhen(row.opened_at)}</td>
                  <td className="px-3 py-2">{formatWhen(row.closed_at)}</td>
                  <td className="px-3 py-2">{row.actor_login ?? "—"}</td>
                  <td className="px-3 py-2">
                    {row.expected_cash_minor == null
                      ? "—"
                      : formatIdr(row.expected_cash_minor)}
                  </td>
                  <td className="px-3 py-2">
                    {row.counted_cash_minor == null
                      ? "—"
                      : formatIdr(row.counted_cash_minor)}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {row.difference_minor == null
                      ? "—"
                      : formatIdr(row.difference_minor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
