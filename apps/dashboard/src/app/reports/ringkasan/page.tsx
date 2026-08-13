"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportSummary } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ReportToolbar, reportQs, todayUtc } from "@/components/report-toolbar";
import { StatCard } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { ReportNote } from "../report-shared";

export default function ReportSummaryPage() {
  const me = useDashboardSession();
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const canExport = hasPermission(me.permissions, "reports", "export");
  const [from, setFrom] = useState(todayUtc);
  const [to, setTo] = useState(todayUtc);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (range: { from: string; to: string }) => {
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/reports/summary?${reportQs(range.from, range.to)}`);
      if (!res.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
      setSummary((await res.json()) as ReportSummary);
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
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onApiCsv() {
    setError(null);
    try {
      const res = await authorizedFetch(`/reports/export?${reportQs(from, to)}`);
      if (!res.ok) {
        setError("Ekspor ditolak.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal mengekspor.");
    }
  }

  const table = useMemo(() => {
    if (!summary) return null;
    const headers = ["Metrik", "Nilai"];
    const rows: Array<Array<string | number>> = [
      ["Pendapatan", formatIdr(summary.revenue_minor)],
      ["Transaksi", summary.txn_count],
      ["Unit", summary.units],
      ["AOV", formatIdr(summary.aov_minor)],
      ["Diskon", formatIdr(summary.discount_minor)],
      ["Refund", formatIdr(summary.refund_minor)],
      ["Bersih", formatIdr(summary.net_minor)],
    ];
    if (isAdmin) {
      rows.push(
        ["HPP", formatIdr(summary.cogs_minor ?? 0)],
        ["Laba kotor", formatIdr(summary.gross_profit_minor ?? 0)],
        ["Pajak", formatIdr(summary.tax_minor ?? 0)],
        ["Biaya", formatIdr(summary.fees_minor ?? 0)],
      );
    }
    return {
      title: `Ringkasan ${from}–${to}`,
      filename: `laporan-ringkasan-${from}-${to}`,
      headers,
      rows,
    };
  }, [from, isAdmin, summary, to]);

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
        extra={
          canExport ? (
            <Button
              type="button"
              className="bg-secondary text-secondary-foreground hover:opacity-90"
              onClick={() => void onApiCsv()}
            >
              CSV lengkap
            </Button>
          ) : null
        }
      />
      <ReportNote isAdmin={isAdmin} />
      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pendapatan" value={formatIdr(summary?.revenue_minor ?? 0)} />
        <StatCard label="Transaksi" value={summary?.txn_count ?? 0} />
        <StatCard label="Unit" value={summary?.units ?? 0} />
        <StatCard label="AOV" value={formatIdr(summary?.aov_minor ?? 0)} />
        <StatCard label="Diskon" value={formatIdr(summary?.discount_minor ?? 0)} />
        <StatCard label="Refund" value={formatIdr(summary?.refund_minor ?? 0)} />
        <StatCard
          label="Bersih"
          value={formatIdr(summary?.net_minor ?? 0)}
          hint="Pendapatan dikurangi refund"
          tone="success"
        />
      </div>
      {isAdmin ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Snapshot keuangan</h2>
          <p className="text-sm text-muted-foreground">
            Bukan buku besar. HPP memakai harga modal produk, bukan FIFO.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="HPP" value={formatIdr(summary?.cogs_minor ?? 0)} />
            <StatCard label="Laba kotor" value={formatIdr(summary?.gross_profit_minor ?? 0)} />
            <StatCard label="Pajak" value={formatIdr(summary?.tax_minor ?? 0)} />
            <StatCard label="Biaya" value={formatIdr(summary?.fees_minor ?? 0)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
