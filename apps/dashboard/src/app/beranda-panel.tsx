"use client";

import { StatCard, SurfaceCard } from "@pos-apps/ui/molecules";
import { AreaChart, DonutChart, HBarChart } from "@pos-apps/ui/organisms";
import { Skeleton } from "@pos-apps/ui/atoms";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CurrencyCircleDollarIcon,
  PackageIcon,
  ReceiptIcon,
  TrendUpIcon,
  WarehouseIcon,
} from "@phosphor-icons/react";
import type {
  ProductListResponse,
  ReportCashiersResponse,
  ReportDailyResponse,
  ReportInventoryResponse,
  ReportProductsResponse,
  ReportSummary,
} from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { authorizedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatIdr } from "@/lib/format-money";
import { DateRangeFilter, shiftUtc, todayUtc } from "@/components/organisms/report-toolbar";

const DAY_MS = 86_400_000;

function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

function shiftDate(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" });
const dayLongFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fmtDay(day: string): string {
  return dayFmt.format(new Date(`${day}T00:00:00Z`));
}

function compactIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function periodLabel(from: string, to: string): string {
  const days = daysInRange(from, to);
  if (days === 1) return from === todayUtc() ? "Hari ini" : fmtDay(from);
  return `${days} hari`;
}

function Delta({ current, previous, days }: { current: number; previous: number | undefined; days: number }) {
  const suffix = days === 1 ? "vs hari sebelumnya" : `vs ${days} hari sebelumnya`;
  if (previous == null) return <span className="text-muted-foreground">{suffix}</span>;
  if (previous === 0 && current === 0) return <span className="text-muted-foreground">Belum ada data {suffix}</span>;
  if (previous === 0) return <span className="font-medium text-success">Baru · {suffix}</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span className="text-muted-foreground">
      <span className={up ? "font-semibold text-success" : "font-semibold text-destructive"}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(pct === 0 || Math.abs(pct) >= 10 ? 0 : 1)}%
      </span>{" "}
      {suffix}
    </span>
  );
}

export function BerandaPanel() {
  const me = useDashboardSession();
  const canViewReports = hasPermission(me.permissions, "reports", "view");
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const canViewProducts = hasPermission(me.permissions, "products", "view");
  const [range, setRange] = useState(() => ({ from: shiftUtc(-6), to: todayUtc() }));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [previous, setPrevious] = useState<ReportSummary | null>(null);
  const [daily, setDaily] = useState<ReportDailyResponse | null>(null);
  const [products, setProducts] = useState<ReportProductsResponse | null>(null);
  const [cashiers, setCashiers] = useState<ReportCashiersResponse | null>(null);
  const [inventory, setInventory] = useState<ReportInventoryResponse | null>(null);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const days = daysInRange(range.from, range.to);
  const label = periodLabel(range.from, range.to);

  useEffect(() => {
    if (!canViewProducts) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authorizedFetch("/catalog/products?page=1&limit=1");
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as ProductListResponse;
        setCatalogCount(data.meta?.total ?? data.products.length);
      } catch {
        /* catalog count is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canViewProducts]);

  useEffect(() => {
    let cancelled = false;
    const q = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    const prevQ = `from=${encodeURIComponent(shiftDate(range.from, -days))}&to=${encodeURIComponent(shiftDate(range.from, -1))}`;

    void (async () => {
      setPending(true);
      setError(null);
      try {
        const jobs: Array<Promise<void>> = [];

        if (canViewReports) {
          jobs.push(
            (async () => {
              const [summaryRes, prevRes, dailyRes, productsRes, cashiersRes] = await Promise.all([
                authorizedFetch(`/reports/summary?${q}`),
                authorizedFetch(`/reports/summary?${prevQ}`),
                authorizedFetch(`/reports/daily?${q}`),
                authorizedFetch(`/reports/products?${q}`),
                authorizedFetch(`/reports/cashiers?${q}`),
              ]);
              if (cancelled) return;
              if (!summaryRes.ok || !dailyRes.ok || !productsRes.ok || !cashiersRes.ok) {
                setError("Gagal memuat ringkasan penjualan.");
                return;
              }
              setSummary((await summaryRes.json()) as ReportSummary);
              setPrevious(prevRes.ok ? ((await prevRes.json()) as ReportSummary) : null);
              setDaily((await dailyRes.json()) as ReportDailyResponse);
              setProducts((await productsRes.json()) as ReportProductsResponse);
              setCashiers((await cashiersRes.json()) as ReportCashiersResponse);
            })(),
          );
        }

        if (isAdmin) {
          jobs.push(
            (async () => {
              const invRes = await authorizedFetch(`/reports/inventory?${q}`);
              if (cancelled || !invRes.ok) return;
              setInventory((await invRes.json()) as ReportInventoryResponse);
            })(),
          );
        }

        await Promise.all(jobs);
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
        ) {
          return;
        }
        if (!cancelled) setError("Gagal memuat beranda.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canViewReports, isAdmin, range.from, range.to, days]);

  const topBars = (products?.top ?? []).slice(0, 6).map((row) => ({
    label: row.name,
    value: row.units,
    hint: `${row.units} unit · ${formatIdr(row.revenue_minor)}`,
  }));

  const cashierBars = (cashiers?.cashiers ?? []).slice(0, 6).map((row, i) => ({
    label: `${row.cashier_username ?? "Kasir"} (${i + 1})`,
    value: row.revenue_minor,
    hint: formatIdr(row.revenue_minor),
  }));

  const trend = useMemo(
    () =>
      (daily?.days ?? []).map((d) => ({
        label: fmtDay(d.date),
        title: dayLongFmt.format(new Date(`${d.date}T00:00:00Z`)),
        value: d.revenue_minor,
        details: [
          { label: "Transaksi", value: String(d.txn_count) },
          { label: "Unit", value: String(d.units) },
          { label: "Bersih", value: formatIdr(d.net_minor) },
        ],
      })),
    [daily],
  );
  const bestDay = (daily?.days ?? []).reduce<ReportDailyResponse["days"][number] | null>(
    (best, d) => (d.revenue_minor > (best?.revenue_minor ?? 0) ? d : best),
    null,
  );
  const overviewCardCount = (canViewReports ? 4 : 1) + (canViewProducts ? 1 : 0) + (isAdmin ? 1 : 0);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            Ikhtisar penjualan
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {fmtDay(range.from)}
            {range.from !== range.to ? ` – ${fmtDay(range.to)}` : ""}{" "}
            <span className="text-base font-normal text-muted-foreground">· {label} (UTC)</span>
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Data dari penjualan yang sudah tersinkron dari kasir.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          {canViewReports ? (
            <DateRangeFilter
              from={range.from}
              to={range.to}
              pending={pending}
              onApply={setRange}
            />
          ) : null}
          <div className="flex items-center gap-3">
            {pending ? (
              <span className="text-xs text-muted-foreground" role="status">
                Memuat…
              </span>
            ) : null}
            <Link
              href="/reports/ringkasan"
              scroll={false}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Lihat laporan
            </Link>
          </div>
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

      <div className={pending && !loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: overviewCardCount }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canViewReports ? (
              <>
                <StatCard
                  className="min-h-36"
                  label={`Pendapatan · ${label}`}
                  value={formatIdr(summary?.revenue_minor ?? 0)}
                  hint={<Delta current={summary?.revenue_minor ?? 0} previous={previous?.revenue_minor} days={days} />}
                  icon={<CurrencyCircleDollarIcon size={20} weight="bold" />}
                />
                <StatCard
                  className="min-h-36"
                  label="Transaksi"
                  value={summary?.txn_count ?? 0}
                  hint={
                    <>
                      <Delta current={summary?.txn_count ?? 0} previous={previous?.txn_count} days={days} />
                      {summary && summary.txn_count > 0 ? (
                        <span className="mt-0.5 block text-muted-foreground">
                          Rata-rata {formatIdr(summary.aov_minor)} / transaksi
                        </span>
                      ) : null}
                    </>
                  }
                  icon={<ReceiptIcon size={20} weight="bold" />}
                />
                <StatCard
                  className="min-h-36"
                  label="Unit terjual"
                  value={summary?.units ?? 0}
                  hint={<Delta current={summary?.units ?? 0} previous={previous?.units} days={days} />}
                  icon={<PackageIcon size={20} weight="bold" />}
                />
                <StatCard
                  className="min-h-36"
                  label="Bersih"
                  value={formatIdr(summary?.net_minor ?? 0)}
                  hint={<Delta current={summary?.net_minor ?? 0} previous={previous?.net_minor} days={days} />}
                  tone="success"
                  icon={<TrendUpIcon size={20} weight="bold" />}
                />
              </>
            ) : (
              <StatCard
                className="min-h-36"
                label="Beranda"
                value="Siap"
                hint="Akun ini tidak melihat laporan penjualan."
              />
            )}
            {catalogCount != null ? (
              <StatCard
                className="min-h-36"
                label="Produk katalog"
                value={catalogCount}
                hint="Aktif di katalog"
                icon={<PackageIcon size={20} weight="bold" />}
              />
            ) : null}
            {isAdmin && inventory ? (
              <StatCard
                className="min-h-36"
                label="Nilai stok (modal)"
                value={formatIdr(inventory.stock_value_minor)}
                hint="Harga modal produk"
                icon={<WarehouseIcon size={20} weight="bold" />}
              />
            ) : null}
          </div>
        )}
      </div>

      {canViewReports ? (
        loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-96 rounded-2xl xl:col-span-2" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <div className={cn("flex flex-col gap-4", pending && "opacity-60 transition-opacity")}>
            <SurfaceCard className="p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <h2 className="text-base font-semibold">Tren omzet harian</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pendapatan per hari, {fmtDay(range.from)}
                    {range.from !== range.to ? ` – ${fmtDay(range.to)}` : ""}.
                  </p>
                </div>
                {bestDay && bestDay.revenue_minor > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Hari terbaik:{" "}
                    <span className="font-semibold text-foreground">{fmtDay(bestDay.date)}</span>{" "}
                    · {formatIdr(bestDay.revenue_minor)}
                  </p>
                ) : null}
              </div>
              <AreaChart
                data={trend}
                formatValue={formatIdr}
                formatAxis={compactIdr}
                ariaLabel="Tren omzet harian"
                empty="Belum ada data penjualan pada rentang ini."
              />
            </SurfaceCard>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <SurfaceCard className="p-5 sm:p-6">
                <h2 className="text-base font-semibold">Rincian pendapatan</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dari pendapatan ke pendapatan bersih ({label}).
                </p>
                {summary && summary.revenue_minor > 0 ? (
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight tabular-nums">
                        {formatIdr(summary.net_minor)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bersih ·{" "}
                        <span className="font-semibold text-success">
                          {Math.round((summary.net_minor / summary.revenue_minor) * 100)}%
                        </span>{" "}
                        dari pendapatan
                      </p>
                    </div>
                    <div
                      className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-secondary"
                      role="img"
                      aria-label="Proporsi bersih dan refund terhadap pendapatan"
                    >
                      <div
                        className="bg-success"
                        style={{ width: `${(summary.net_minor / summary.revenue_minor) * 100}%` }}
                      />
                      <div
                        className="bg-destructive"
                        style={{ width: `${(summary.refund_minor / summary.revenue_minor) * 100}%` }}
                      />
                    </div>
                    <ul className="divide-y divide-border/70 text-sm">
                      {[
                        { label: "Pendapatan", value: summary.revenue_minor, dot: "bg-primary", sign: "" },
                        { label: "Refund", value: summary.refund_minor, dot: "bg-destructive", sign: "−" },
                        { label: "Bersih", value: summary.net_minor, dot: "bg-success", sign: "" },
                        { label: "Diskon diberikan", value: summary.discount_minor, dot: "bg-warning", sign: "" },
                      ].map((row) => (
                        <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className={cn("size-2.5 rounded-full", row.dot)} />
                            {row.label}
                          </span>
                          <span className="tabular-nums">
                            <span className="font-medium">
                              {row.sign}
                              {formatIdr(row.value)}
                            </span>
                            <span className="ml-2 inline-block w-10 text-right text-muted-foreground">
                              {Math.round((row.value / summary.revenue_minor) * 100)}%
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Belum ada penjualan pada rentang ini.
                  </p>
                )}
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <h2 className="text-base font-semibold">Produk terlaris</h2>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">
                  Unit terjual ({label}).
                </p>
                <HBarChart data={topBars} empty="Belum ada penjualan produk pada rentang ini." />
              </SurfaceCard>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <SurfaceCard className="p-5 sm:p-6">
                <h2 className="text-base font-semibold">Kinerja kasir</h2>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">
                  Omzet per kasir atau shift ({label}).
                </p>
                <HBarChart data={cashierBars} empty="Belum ada data kasir pada rentang ini." />
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <h2 className="text-base font-semibold">Metode pembayaran</h2>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">
                  Tunai dibanding QRIS ({label}).
                </p>
                <DonutChart
                  data={[
                    { label: "Tunai", value: summary?.cash_minor ?? 0, color: "var(--primary)", hint: formatIdr(summary?.cash_minor ?? 0) },
                    { label: "QRIS", value: summary?.qris_minor ?? 0, color: "var(--success)", hint: formatIdr(summary?.qris_minor ?? 0) },
                  ]}
                  center={
                    <>
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {compactIdr((summary?.cash_minor ?? 0) + (summary?.qris_minor ?? 0))}
                      </span>
                    </>
                  }
                  empty="Belum ada pembayaran pada rentang ini."
                />
              </SurfaceCard>
            </div>
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Gunakan menu di samping untuk stok, pelanggan, atau shift sesuai izin akun.
        </p>
      )}
    </div>
  );
}
