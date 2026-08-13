"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportCashiersResponse } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ReportToolbar, reportQs, todayUtc } from "@/components/report-toolbar";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { Bar, ReportNote } from "../report-shared";

export default function ReportCashiersPage() {
  const me = useDashboardSession();
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const [from, setFrom] = useState(todayUtc);
  const [to, setTo] = useState(todayUtc);
  const [cashiers, setCashiers] = useState<ReportCashiersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (range: { from: string; to: string }) => {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/reports/cashiers?${reportQs(range.from, range.to)}`);
      if (!res.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
      setCashiers((await res.json()) as ReportCashiersResponse);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat laporan.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxRevenue = useMemo(
    () => Math.max(0, ...(cashiers?.cashiers.map((c) => c.revenue_minor) ?? [])),
    [cashiers],
  );

  const table = useMemo(
    () => ({
      title: `Kasir ${from}–${to}`,
      filename: `laporan-kasir-${from}-${to}`,
      headers: ["Kasir", "Shift", "Omzet", "Txn", "Refund"],
      rows: (cashiers?.cashiers ?? []).map((row) => [
        row.cashier_username ?? "—",
        row.shift_id ?? "—",
        formatIdr(row.revenue_minor),
        row.txn_count,
        formatIdr(row.refund_minor),
      ]),
    }),
    [cashiers, from, to],
  );

  return (
    <div className="flex flex-col gap-6">
      <ReportToolbar
        from={from}
        to={to}
        pending={pending}
        table={table}
        onApply={(range) => {
          setFrom(range.from);
          setTo(range.to);
          void load(range);
        }}
      />
      <ReportNote isAdmin={isAdmin} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Kinerja kasir / shift</h2>
        {!isAdmin ? (
          <p className="text-sm text-muted-foreground">
            Hanya menampilkan penjualan dan refund milik Anda.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">Kasir</th>
                <th className="px-3 py-2 font-medium">Shift</th>
                <th className="px-3 py-2 font-medium">Omzet</th>
                <th className="px-3 py-2 font-medium">Txn</th>
                <th className="px-3 py-2 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {(cashiers?.cashiers.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                    Tidak ada data kinerja di rentang ini.
                  </td>
                </tr>
              ) : (
                cashiers?.cashiers.map((row) => (
                  <tr
                    key={`${row.cashier_id ?? "none"}:${row.shift_id ?? "none"}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-2">
                      {row.cashier_username ?? "—"}
                      <div className="mt-1 max-w-[10rem]">
                        <Bar value={row.revenue_minor} max={maxRevenue} />
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.shift_id ?? "—"}</td>
                    <td className="px-3 py-2">{formatIdr(row.revenue_minor)}</td>
                    <td className="px-3 py-2">{row.txn_count}</td>
                    <td className="px-3 py-2">{formatIdr(row.refund_minor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
