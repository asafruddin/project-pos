"use client";

import { StatCard, SurfaceCard } from "@pos-apps/ui/molecules";
import { Skeleton } from "@pos-apps/ui/atoms";
import {
  ChartLineUpIcon,
  CoinsIcon,
  PackageIcon,
  ReceiptIcon,
  TagIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ReportSummary } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ReportToolbar, reportQs, todayUtc } from "@/components/organisms/report-toolbar";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { ReportNote } from "../report-shared";

const numberId = new Intl.NumberFormat("id-ID");

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function dayCount(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function percent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function PaymentRow({
  label,
  amount,
  pct,
  swatch,
}: {
  label: string;
  amount: ReactNode;
  pct: number;
  swatch: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("size-2.5 rounded-full", swatch)} aria-hidden />
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-foreground">{amount}</span>
        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
          {pct.toLocaleString("id-ID")}%
        </span>
      </span>
    </div>
  );
}

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
      ["Tunai", formatIdr(summary.cash_minor)],
      ["QRIS", formatIdr(summary.qris_minor)],
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

  const loading = !summary && pending;
  // Skeleton while the first load runs, a dash if it failed, otherwise the value.
  const show = (value: ReactNode, skeletonClass = "h-8 w-28"): ReactNode =>
    summary ? value : loading ? <Skeleton className={skeletonClass} /> : "–";

  const revenue = summary?.revenue_minor ?? 0;
  const cash = summary?.cash_minor ?? 0;
  const qris = summary?.qris_minor ?? 0;
  const paid = cash + qris;
  const cashPct = percent(cash, paid);
  const qrisPct = paid > 0 ? Math.round((100 - cashPct) * 10) / 10 : 0;
  const empty = summary !== null && summary.txn_count === 0;
  const days = dayCount(from, to);

  return (
    <div className="flex flex-col gap-6">
      <ReportToolbar
        from={from}
        to={to}
        pending={pending}
        table={table}
        exportExtras={
          canExport
            ? [
                {
                  label: "CSV lengkap",
                  description: "Seluruh data transaksi pada rentang ini",
                  onSelect: () => void onApiCsv(),
                },
              ]
            : undefined
        }
        onApply={(range) => {
          setFrom(range.from);
          setTo(range.to);
          void load(range);
        }}
      />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          {from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {days === 1 ? "1 hari" : `${days} hari`}
          </span>
        </p>
        <ReportNote isAdmin={isAdmin} />
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          Belum ada transaksi pada rentang ini. Coba pilih rentang tanggal yang lebih lebar.
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-6 transition-opacity",
          pending && summary ? "opacity-60" : "opacity-100",
        )}
        aria-busy={pending}
      >
        <section className="grid gap-3 lg:grid-cols-5">
          <SurfaceCard className="p-5 sm:p-6 lg:col-span-3">
            <p className="text-sm text-muted-foreground">Pendapatan bersih</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {show(formatIdr(summary?.net_minor ?? 0), "h-10 w-48")}
            </p>
            <p className="mt-1 text-xs text-success">Pendapatan dikurangi refund</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">Pendapatan kotor</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {show(formatIdr(revenue), "h-6 w-28")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Refund</dt>
                <dd
                  className={cn(
                    "mt-1 text-lg font-semibold",
                    (summary?.refund_minor ?? 0) > 0 && "text-destructive",
                  )}
                >
                  {show(
                    (summary?.refund_minor ?? 0) > 0
                      ? `− ${formatIdr(summary?.refund_minor ?? 0)}`
                      : formatIdr(0),
                    "h-6 w-28",
                  )}
                </dd>
              </div>
            </dl>
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6 lg:col-span-2">
            <p className="text-sm text-muted-foreground">Metode pembayaran</p>
            <div
              className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`Tunai ${cashPct}%, QRIS ${qrisPct}%`}
            >
              <div className="h-full bg-primary transition-all" style={{ width: `${cashPct}%` }} />
              <div className="h-full bg-success transition-all" style={{ width: `${qrisPct}%` }} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <PaymentRow
                label="Tunai"
                swatch="bg-primary"
                pct={cashPct}
                amount={show(formatIdr(cash), "h-5 w-24")}
              />
              <PaymentRow
                label="QRIS"
                swatch="bg-success"
                pct={qrisPct}
                amount={show(formatIdr(qris), "h-5 w-24")}
              />
            </div>
          </SurfaceCard>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading title="Aktivitas penjualan" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Transaksi"
              icon={<ReceiptIcon size={20} aria-hidden />}
              value={show(numberId.format(summary?.txn_count ?? 0))}
              hint="Jumlah struk selesai"
            />
            <StatCard
              label="Unit terjual"
              icon={<PackageIcon size={20} aria-hidden />}
              value={show(numberId.format(summary?.units ?? 0))}
              hint="Total item di semua transaksi"
            />
            <StatCard
              label="Rata-rata per transaksi"
              icon={<ChartLineUpIcon size={20} aria-hidden />}
              value={show(formatIdr(summary?.aov_minor ?? 0))}
              hint="AOV · pendapatan ÷ transaksi"
            />
            <StatCard
              label="Diskon diberikan"
              icon={<TagIcon size={20} aria-hidden />}
              value={show(formatIdr(summary?.discount_minor ?? 0))}
              hint="Sudah termasuk dalam pendapatan"
            />
          </div>
        </section>

        {isAdmin ? (
          <section className="flex flex-col gap-3">
            <SectionHeading
              title="Snapshot keuangan"
              description="Perkiraan, bukan buku besar. HPP memakai harga modal produk, bukan FIFO."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="HPP"
                icon={<CoinsIcon size={20} aria-hidden />}
                value={show(formatIdr(summary?.cogs_minor ?? 0))}
                hint="Harga pokok penjualan"
              />
              <StatCard
                label="Laba kotor"
                tone="success"
                value={show(formatIdr(summary?.gross_profit_minor ?? 0))}
                hint={
                  summary && revenue > 0
                    ? `Margin ${percent(summary.gross_profit_minor ?? 0, revenue).toLocaleString("id-ID")}% dari pendapatan`
                    : "Pendapatan − HPP"
                }
              />
              <StatCard
                label="Pajak"
                value={show(formatIdr(summary?.tax_minor ?? 0))}
              />
              <StatCard
                label="Biaya"
                value={show(formatIdr(summary?.fees_minor ?? 0))}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
