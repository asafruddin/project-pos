"use client";

import {
  ChartLineUpIcon,
  CheckCircleIcon,
  CurrencyCircleDollarIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, SalesListResponse } from "@pos-apps/types";
import {
  DashboardLoading,
  DashboardShell,
} from "@/components/dashboard-shell";
import { StatCard } from "@/components/ui/brand";
import { clearSession, getAccessToken } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SalesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [data, setData] = useState<SalesListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setReady(true);
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const meRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) {
          clearSession();
          setReady(true);
          router.replace("/login");
          return;
        }
        setMe((await meRes.json()) as AuthMeResponse);

        const salesRes = await fetch(`${API_URL}/sales`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (salesRes.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (!salesRes.ok) {
          setError("Gagal memuat penjualan.");
          setReady(true);
          return;
        }
        setData((await salesRes.json()) as SalesListResponse);
        setReady(true);
      } catch {
        clearSession();
        setReady(true);
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!ready || !me) {
    return <DashboardLoading />;
  }

  const salesCount = data?.sales.length ?? 0;

  return (
    <DashboardShell
      role={me.role}
      title="Penjualan"
      subtitle="Ringkasan penjualan yang sudah tersinkron dari kasir (bukan data offline lokal)."
    >
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
