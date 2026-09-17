"use client";

import { StatCard } from "@pos-apps/ui/molecules";
import {
  ChartLineUpIcon,
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

  const salesCount = data?.sales.filter((s) => !s.voided_at).length ?? 0;
  const totals = data?.tender_totals ?? EMPTY_TENDER_TOTALS;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total hari ini (UTC)"
          value={formatIdr(data?.daily_total_minor ?? 0)}
          tone="success"
          icon={<CurrencyCircleDollarIcon size={22} weight="duotone" />}
        />
        <StatCard
          label="Transaksi tersinkron"
          value={salesCount}
          tone="default"
          icon={<ChartLineUpIcon size={22} weight="duotone" />}
        />
        <StatCard
          label="Status"
          value={error ? "Error" : salesCount ? "Aktif" : "Kosong"}
          hint={error ?? "Data dari sync kasir"}
          tone={error ? "danger" : salesCount ? "warning" : "default"}
          icon={
            error ? (
              <WarningCircleIcon size={22} weight="duotone" />
            ) : (
              <CheckCircleIcon size={22} weight="duotone" />
            )
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-3">
        <StatCard
          label="Tunai"
          value={formatIdr(totals.cash_minor)}
          hint={txnHint(totals.cash_count)}
          icon={<MoneyIcon size={22} weight="duotone" />}
        />
        <StatCard
          label="QRIS"
          value={formatIdr(totals.qris_minor)}
          hint={txnHint(totals.qris_count)}
          icon={<QrCodeIcon size={22} weight="duotone" />}
        />
        <StatCard
          label="Kredit toko"
          value={formatIdr(totals.store_credit_minor)}
          hint={txnHint(totals.store_credit_count)}
          icon={<WalletIcon size={22} weight="duotone" />}
        />
      </div>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!data || data.sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground shadow-card mt-3">
          Belum ada penjualan tersinkron. Daftar ini terisi setelah kasir
          mengunggah penjualan selesai — bukan mode offline kasir.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card mt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-md border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Metode</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => {
                  const method = methodDisplay(s.payment);
                  return (
                    <tr
                      key={s.sale_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 text-foreground">
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(s.completed_at))}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div>{method.label}</div>
                        {method.detail ? (
                          <div className="text-xs text-muted-foreground">
                            {method.detail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatIdr(s.amount_minor)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.voided_at ? "Void" : "Selesai"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
