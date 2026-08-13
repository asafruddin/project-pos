"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportInventoryResponse } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ReportToolbar, reportQs, todayUtc } from "@/components/report-toolbar";
import { StatCard } from "@/components/ui/brand";
import { FormDenied } from "@/components/ui/form";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { ReportNote } from "../report-shared";

export default function ReportStockPage() {
  const me = useDashboardSession();
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const [from, setFrom] = useState(todayUtc);
  const [to, setTo] = useState(todayUtc);
  const [inventory, setInventory] = useState<ReportInventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (range: { from: string; to: string }) => {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/reports/inventory?${reportQs(range.from, range.to)}`);
      if (!res.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
      setInventory((await res.json()) as ReportInventoryResponse);
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
    if (!isAdmin) return;
    void load({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const table = useMemo(() => {
    if (!inventory) return null;
    return {
      title: `Stok ${from}–${to}`,
      filename: `laporan-stok-${from}-${to}`,
      headers: ["Kelompok", "Item", "Nilai"],
      rows: [
        ["Nilai stok", "Modal jual", formatIdr(inventory.stock_value_minor)],
        ...inventory.movements.map((row) => ["Pergerakan", row.reason, row.qty_delta]),
        ...inventory.opname_variances.map((row) => [
          "Opname",
          row.opname_id,
          row.variance,
        ]),
        ...inventory.dead_stock.map((row) => ["Stok mati", row.name, row.sellable_qty]),
      ],
    };
  }, [from, inventory, to]);

  if (!isAdmin) {
    return (
      <FormDenied href="/reports/ringkasan">
        Analitik stok hanya untuk peran keuangan. Kasir tidak melihat HPP atau nilai stok.
      </FormDenied>
    );
  }

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
        <h2 className="text-lg font-semibold">Analitik stok</h2>
        <StatCard
          label="Nilai stok jual (modal)"
          value={formatIdr(inventory?.stock_value_minor ?? 0)}
        />
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">Pergerakan</th>
                <th className="px-3 py-2 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {(inventory?.movements.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                    Tidak ada pergerakan di rentang ini.
                  </td>
                </tr>
              ) : (
                inventory?.movements.map((row) => (
                  <tr key={row.reason} className="border-b border-border/60">
                    <td className="px-3 py-2">{row.reason}</td>
                    <td className="px-3 py-2">{row.qty_delta}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">Opname disetujui</th>
                <th className="px-3 py-2 font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {(inventory?.opname_variances.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                    Tidak ada opname disetujui di rentang ini.
                  </td>
                </tr>
              ) : (
                inventory?.opname_variances.map((row) => (
                  <tr key={row.opname_id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-mono text-xs">{row.opname_id}</td>
                    <td className="px-3 py-2">{row.variance}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 font-medium">Stok mati</th>
                <th className="px-3 py-2 font-medium">Qty jual</th>
              </tr>
            </thead>
            <tbody>
              {(inventory?.dead_stock.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                    Tidak ada stok mati di rentang ini.
                  </td>
                </tr>
              ) : (
                inventory?.dead_stock.map((row) => (
                  <tr key={row.product_id} className="border-b border-border/60">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.sellable_qty}</td>
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
