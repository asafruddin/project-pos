"use client";

import {
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  MoneyIcon,
  QrCodeIcon,
  WalletIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type {
  PaymentMethod,
  SalePayment,
  SalesListResponse,
  SalesTenderTotals,
  TenderMethod,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

const EMPTY_TENDER_TOTALS: SalesTenderTotals = {
  cash_minor: 0,
  qris_minor: 0,
  store_credit_minor: 0,
  cash_count: 0,
  qris_count: 0,
  store_credit_count: 0,
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  store_credit: "Kredit toko",
  split: "Campuran",
};

const TENDER_LABEL: Record<TenderMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  store_credit: "Kredit toko",
};

export default function SalesPage() {
  const [data, setData] = useState<SalesListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const salesRes = await authorizedFetch("/sales");
        if (cancelled) return;
        if (!salesRes.ok) {
          setError("Gagal memuat penjualan.");
          return;
        }
        setData((await salesRes.json()) as SalesListResponse);
      } catch {
        if (!cancelled) setError("Gagal memuat penjualan.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [query, setQuery] = useState("");
  const salesCount = data?.sales.filter((s) => !s.voided_at).length ?? 0;
  const totals = data?.tender_totals ?? EMPTY_TENDER_TOTALS;
  const needle = query.trim().toLowerCase().replace(/^#/, "");
  const rows = (data?.sales ?? []).filter(
    (s) =>
      !needle ||
      String(s.queue_number ?? "") === needle ||
      (s.guest_name ?? "").toLowerCase().includes(needle),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile
          label="Total hari ini (UTC)"
          value={formatIdr(data?.daily_total_minor ?? 0)}
          hint={`${salesCount} transaksi`}
          icon={<CurrencyCircleDollarIcon size={20} weight="duotone" />}
          strong
        />
        <SummaryTile
          label="Tunai"
          value={formatIdr(totals.cash_minor)}
          hint={txnHint(totals.cash_count)}
          icon={<MoneyIcon size={20} weight="duotone" />}
        />
        <SummaryTile
          label="QRIS"
          value={formatIdr(totals.qris_minor)}
          hint={txnHint(totals.qris_count)}
          icon={<QrCodeIcon size={20} weight="duotone" />}
        />
        <SummaryTile
          label="Kredit toko"
          value={formatIdr(totals.store_credit_minor)}
          hint={txnHint(totals.store_credit_count)}
          icon={<WalletIcon size={20} weight="duotone" />}
        />
        <SummaryTile
          label="Status"
          value={error ? "Error" : salesCount ? "Aktif" : "Kosong"}
          hint={error ?? "Data dari sync kasir"}
          icon={
            error ? (
              <WarningCircleIcon size={20} weight="duotone" />
            ) : (
              <CheckCircleIcon size={20} weight="duotone" />
            )
          }
        />
      </div>

      {error ? (
        <div
          className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!data || data.sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground shadow-card">
          Belum ada penjualan tersinkron. Daftar ini terisi setelah kasir
          mengunggah penjualan selesai — bukan mode offline kasir.
        </div>
      ) : (
        <div className="flex min-h-64 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Daftar penjualan{" "}
              <span className="font-normal text-muted-foreground">
                ({rows.length}
                {needle ? ` dari ${data.sales.length}` : ""})
              </span>
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau no. antrian"
              aria-label="Cari penjualan"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary sm:w-64"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table className="w-full min-w-xl border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Antrian</th>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Metode</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Tidak ada penjualan yang cocok.
                    </td>
                  </tr>
                ) : null}
                {rows.map((s) => {
                  const method = methodDisplay(s.payment);
                  const voided = Boolean(s.voided_at);
                  return (
                    <tr
                      key={s.sale_id}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {s.queue_number ? `#${s.queue_number}` : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(s.completed_at))}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {s.guest_name?.trim() || (
                          <span className="text-muted-foreground">Tanpa nama</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div>{method.label}</div>
                        {method.detail ? (
                          <div className="text-xs text-muted-foreground">
                            {method.detail}
                          </div>
                        ) : null}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${voided ? "text-muted-foreground line-through" : ""}`}
                      >
                        {formatIdr(s.amount_minor)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${voided ? "bg-secondary text-muted-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
                        >
                          {voided ? "Void" : "Selesai"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  icon,
  strong,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card ${strong ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="truncate text-xs">{label}</span>
        <span className="shrink-0 text-primary">{icon}</span>
      </div>
      <p className={`truncate font-semibold tabular-nums ${strong ? "text-xl" : "text-lg"} text-foreground`}>
        {value}
      </p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function txnHint(count: number): string {
  return `${count} transaksi`;
}

function methodDisplay(payment: SalePayment | undefined): {
  label: string;
  detail?: string;
} {
  if (!payment) return { label: METHOD_LABEL.cash };
  if (payment.method !== "split") {
    return { label: METHOD_LABEL[payment.method] };
  }
  const parts = (payment.tenders ?? [])
    .filter((row) => row.amount_minor > 0)
    .map((row) => TENDER_LABEL[row.method]);
  const unique = [...new Set(parts)];
  return {
    label: METHOD_LABEL.split,
    detail: unique.length ? unique.join(" + ") : undefined,
  };
}
