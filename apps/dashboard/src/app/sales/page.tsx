"use client";

import {
  ChartLineUpIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { SalesListResponse } from "@pos-apps/types";
import { StatCard } from "@/components/ui/brand";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

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

      {error ? (
        <div
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!data || data.sales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-sm text-muted-foreground">
          Belum ada penjualan tersinkron. Daftar ini terisi setelah kasir
          mengunggah penjualan selesai — bukan mode offline kasir.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
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
                    <td className="px-4 py-3 font-medium">
                      {formatIdr(s.amount_minor)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.voided_at ? "Void" : "Selesai"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
