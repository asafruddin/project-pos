"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ProductListResponse,
  ReportCashiersResponse,
  ReportInventoryResponse,
  ReportProductsResponse,
  ReportSummary,
} from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { StatCard, SurfaceCard } from "@/components/ui/brand";
import { HBarChart, VBarChart } from "@/components/ui/simple-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";
import { todayUtc } from "@/components/report-toolbar";

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
              const catalogRes = await authorizedFetch("/catalog/products");
              if (cancelled || !catalogRes.ok) return;
              const data = (await catalogRes.json()) as ProductListResponse;
              setCatalogCount(data.products.length);
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

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Hari ini (UTC {todayUtc()}). Angka dari penjualan yang sudah tersinkron, bukan antrian
        offline kasir.
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canViewReports ? (
            <>
              <StatCard label="Pendapatan hari ini" value={formatIdr(summary?.revenue_minor ?? 0)} />
              <StatCard label="Transaksi" value={summary?.txn_count ?? 0} />
              <StatCard label="Unit terjual" value={summary?.units ?? 0} />
              <StatCard
                label="Bersih"
                value={formatIdr(summary?.net_minor ?? 0)}
                hint="Pendapatan dikurangi refund"
                tone="success"
              />
            </>
          ) : (
            <StatCard
              label="Beranda"
              value="Siap"
              hint="Akun ini tidak melihat laporan penjualan."
            />
          )}
          {catalogCount != null ? (
            <StatCard label="Produk katalog" value={catalogCount} />
          ) : null}
          {isAdmin && inventory ? (
            <StatCard
              label="Nilai stok (modal)"
              value={formatIdr(inventory.stock_value_minor)}
            />
          ) : null}
        </div>
      )}

      {canViewReports ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <SurfaceCard className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Bauran hari ini</h2>
              <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
                Perbandingan pendapatan, diskon, refund, dan bersih.
              </p>
              <VBarChart data={mix} empty="Belum ada penjualan hari ini." />
            </SurfaceCard>
            <SurfaceCard className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Produk terlaris</h2>
              <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
                Unit terjual hari ini.
              </p>
              <HBarChart data={topBars} empty="Belum ada penjualan produk hari ini." />
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Kinerja kasir</h2>
            <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
              Omzet per kasir/shift hari ini.
            </p>
            <HBarChart data={cashierBars} empty="Belum ada data kasir hari ini." />
          </SurfaceCard>
          <p className="text-sm">
            <Link
              href="/reports/ringkasan"
              scroll={false}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Buka laporan lengkap
            </Link>
            <span className="text-muted-foreground">
              {" "}
              untuk rentang tanggal, ekspor CSV/Excel/PDF, dan rincian stok.
            </span>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Gunakan menu di samping untuk stok, pelanggan, atau shift sesuai izin akun.
        </p>
      )}
    </div>
  );
}
