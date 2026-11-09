"use client";

import { StatCard, SurfaceCard } from "@pos-apps/ui/molecules";
import { HBarChart, VBarChart } from "@pos-apps/ui/organisms";
import { Skeleton } from "@pos-apps/ui/atoms";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  ReportInventoryResponse,
  ReportProductsResponse,
  ReportSummary,
} from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { todayUtc } from "@/components/organisms/report-toolbar";

export function BerandaPanel() {
  const me = useDashboardSession();
  const canViewReports = hasPermission(me.permissions, "reports", "view");
  const isAdmin = hasPermission(me.permissions, "reports", "view_financial");
  const canViewProducts = hasPermission(me.permissions, "products", "view");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [products, setProducts] = useState<ReportProductsResponse | null>(null);
  const [cashiers, setCashiers] = useState<ReportCashiersResponse | null>(null);
  const [inventory, setInventory] = useState<ReportInventoryResponse | null>(null);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const day = todayUtc();
    const q = `from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const jobs: Array<Promise<void>> = [];

        if (canViewReports) {
          jobs.push(
            (async () => {
              const [summaryRes, productsRes, cashiersRes] = await Promise.all([
                authorizedFetch(`/reports/summary?${q}`),
                authorizedFetch(`/reports/products?${q}`),
                authorizedFetch(`/reports/cashiers?${q}`),
              ]);
              if (cancelled) return;
              if (!summaryRes.ok || !productsRes.ok || !cashiersRes.ok) {
                setError("Gagal memuat ringkasan hari ini.");
                return;
              }
              setSummary((await summaryRes.json()) as ReportSummary);
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

        if (canViewProducts) {
          jobs.push(
            (async () => {
              const catalogRes = await authorizedFetch(
                "/catalog/products?page=1&limit=1",
              );
              if (cancelled || !catalogRes.ok) return;
              const data = (await catalogRes.json()) as ProductListResponse;
              setCatalogCount(data.meta?.total ?? data.products.length);
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
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canViewProducts, canViewReports, isAdmin]);

  const mix = summary
    ? [
        { label: "Pendapatan", value: summary.revenue_minor, hint: formatIdr(summary.revenue_minor) },
        { label: "Diskon", value: summary.discount_minor, hint: formatIdr(summary.discount_minor) },
        { label: "Refund", value: summary.refund_minor, hint: formatIdr(summary.refund_minor) },
        { label: "Bersih", value: summary.net_minor, hint: formatIdr(summary.net_minor) },
      ]
    : [];

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
  const overviewCardCount = (canViewReports ? 4 : 1) + (canViewProducts ? 1 : 0) + (isAdmin ? 1 : 0);

  return (
    <div className="flex flex-col gap-7 pb-8">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
            Ikhtisar harian
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Pantau performa toko dengan cepat
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Data penjualan yang tampil sudah tersinkron dari kasir. Periode: hari ini, UTC {todayUtc()}.
          </p>
        </div>
        <Link
          href="/reports/ringkasan"
          scroll={false}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Lihat laporan
        </Link>
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

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
                label="Pendapatan hari ini"
                value={formatIdr(summary?.revenue_minor ?? 0)}
                hint="Hari ini (UTC)"
                icon={<CurrencyCircleDollarIcon size={20} weight="bold" />}
              />
              <StatCard
                className="min-h-36"
                label="Transaksi"
                value={summary?.txn_count ?? 0}
                hint="Tersinkron"
                icon={<ReceiptIcon size={20} weight="bold" />}
              />
              <StatCard
                className="min-h-36"
                label="Unit terjual"
                value={summary?.units ?? 0}
                hint="Hari ini (UTC)"
                icon={<PackageIcon size={20} weight="bold" />}
              />
              <StatCard
                className="min-h-36"
                label="Bersih"
                value={formatIdr(summary?.net_minor ?? 0)}
                hint="Pendapatan dikurangi refund"
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

      {canViewReports ? (
        loading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl xl:col-span-2" />
          </div>
        ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <SurfaceCard className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Bauran hari ini</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ringkasan pendapatan dan pengurangannya.
                  </p>
                </div>
              </div>
              <VBarChart data={mix} empty="Belum ada penjualan hari ini." />
            </SurfaceCard>
            <SurfaceCard className="p-5 sm:p-6">
              <h2 className="text-base font-semibold">Produk terlaris</h2>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">
                Unit terjual hari ini.
              </p>
              <HBarChart data={topBars} empty="Belum ada penjualan produk hari ini." />
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <h2 className="text-base font-semibold">Kinerja kasir</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Omzet per kasir atau shift hari ini.
                </p>
              </div>
            </div>
            <HBarChart data={cashierBars} empty="Belum ada data kasir hari ini." />
          </SurfaceCard>
          <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span className="text-muted-foreground">
              Butuh rentang tanggal atau rincian lebih lengkap?
            </span>
            <Link
              href="/reports/ringkasan"
              scroll={false}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Buka laporan lengkap →
            </Link>
          </div>
        </>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Gunakan menu di samping untuk stok, pelanggan, atau shift sesuai izin akun.
        </p>
      )}
    </div>
  );
}
