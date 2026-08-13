"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  ReportCashiersResponse,
  ReportInventoryResponse,
  ReportProductsResponse,
  ReportSummary,
  Role,
} from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/brand";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function qs(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 overflow-hidden rounded-sm bg-secondary">
      <div
        className="h-2 rounded-sm bg-primary"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ProductTable({
  rows,
  showMargin,
}: {
  rows: ReportProductsResponse["top"];
  showMargin: boolean;
}) {
  const maxUnits = Math.max(0, ...rows.map((r) => r.units));
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Tidak ada penjualan di rentang ini.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 font-medium">Produk</th>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium">Omzet</th>
            {showMargin ? (
              <th className="px-3 py-2 font-medium">Margin</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product_id} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status === "inactive" ? "Nonaktif (historis)" : "Aktif"}
                </p>
                <div className="mt-1 max-w-[12rem]">
                  <Bar value={row.units} max={maxUnits} />
                </div>
              </td>
              <td className="px-3 py-2">{row.units}</td>
              <td className="px-3 py-2">{formatIdr(row.revenue_minor)}</td>
              {showMargin ? (
                <td className="px-3 py-2">
                  {formatIdr(row.margin_minor ?? 0)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsPanel({
  permissions,
}: {
  role: Role;
  permissions?: string[];
}) {
  const isAdmin = hasPermission(permissions, "reports", "view_financial");
  const [from, setFrom] = useState(todayUtc);
  const [to, setTo] = useState(todayUtc);
  const [applied, setApplied] = useState({ from: todayUtc(), to: todayUtc() });
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [products, setProducts] = useState<ReportProductsResponse | null>(null);
  const [inventory, setInventory] = useState<ReportInventoryResponse | null>(
    null,
  );
  const [cashiers, setCashiers] = useState<ReportCashiersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    async (range: { from: string; to: string }) => {
      setPending(true);
      setError(null);
      try {
        const q = qs(range.from, range.to);
        const [summaryRes, productsRes, cashiersRes] = await Promise.all([
          authorizedFetch(`/reports/summary?${q}`),
          authorizedFetch(`/reports/products?${q}`),
          authorizedFetch(`/reports/cashiers?${q}`),
        ]);
        if (!summaryRes.ok || !productsRes.ok || !cashiersRes.ok) {
          setError("Gagal memuat laporan.");
          return;
        }
        setSummary((await summaryRes.json()) as ReportSummary);
        setProducts((await productsRes.json()) as ReportProductsResponse);
        setCashiers((await cashiersRes.json()) as ReportCashiersResponse);

        if (isAdmin) {
          const invRes = await authorizedFetch(`/reports/inventory?${q}`);
          if (invRes.ok) {
            setInventory((await invRes.json()) as ReportInventoryResponse);
          } else {
            setInventory(null);
          }
        } else {
          setInventory(null);
        }
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === "AUTH_UNAUTHORIZED" ||
            err.message === "AUTH_SESSION_EXPIRED")
        ) {
          return;
        }
        setError("Gagal memuat laporan.");
      } finally {
        setPending(false);
      }
    },
    [isAdmin],
  );

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setApplied({ from, to });
  }

  async function onExport() {
    setError(null);
    try {
      const res = await authorizedFetch(
        `/reports/export?${qs(applied.from, applied.to)}`,
      );
      if (!res.ok) {
        setError("Ekspor ditolak.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${applied.from}-${applied.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Gagal mengekspor.");
    }
  }

  const showMargin = isAdmin && summary?.cogs_minor != null;
  const maxCashierRevenue = useMemo(
    () => Math.max(0, ...(cashiers?.cashiers.map((c) => c.revenue_minor) ?? [])),
    [cashiers],
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={onSubmit}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="report-from">Dari (UTC)</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor="report-to">Sampai (UTC)</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending}>
          Terapkan
        </Button>
        {isAdmin ? (
          <Button
            type="button"
            className="bg-secondary text-secondary-foreground"
            onClick={() => void onExport()}
          >
            Unduh CSV
          </Button>
        ) : null}
      </form>

      <p className="text-xs text-muted-foreground">
        Store #1 · data tersinkron (bukan antrian offline kasir). Tidak
        mengosongkan Sync.
        {isAdmin
          ? null
          : " Anda hanya melihat penjualan dan refund shift sendiri, tanpa HPP."}
      </p>

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
            Bukan buku besar. HPP memakai harga modal produk, bukan FIFO. Pajak
            dan biaya 0 sampai dicatat.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="HPP" value={formatIdr(summary?.cogs_minor ?? 0)} />
            <StatCard
              label="Laba kotor"
              value={formatIdr(summary?.gross_profit_minor ?? 0)}
            />
            <StatCard label="Pajak" value={formatIdr(summary?.tax_minor ?? 0)} />
            <StatCard label="Biaya" value={formatIdr(summary?.fees_minor ?? 0)} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Produk terlaris</h2>
        <ProductTable rows={products?.top ?? []} showMargin={showMargin} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Produk lambat</h2>
        <ProductTable rows={products?.slow ?? []} showMargin={showMargin} />
      </section>

      {isAdmin && inventory ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Analitik stok</h2>
          <StatCard
            label="Nilai stok jual (modal)"
            value={formatIdr(inventory.stock_value_minor)}
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
                {inventory.movements.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                      Tidak ada pergerakan di rentang ini.
                    </td>
                  </tr>
                ) : (
                  inventory.movements.map((row) => (
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
                {inventory.opname_variances.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                      Tidak ada opname disetujui di rentang ini.
                    </td>
                  </tr>
                ) : (
                  inventory.opname_variances.map((row) => (
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
                {inventory.dead_stock.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                      Tidak ada stok mati di rentang ini.
                    </td>
                  </tr>
                ) : (
                  inventory.dead_stock.map((row) => (
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
                        <Bar value={row.revenue_minor} max={maxCashierRevenue} />
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.shift_id ?? "—"}
                    </td>
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
