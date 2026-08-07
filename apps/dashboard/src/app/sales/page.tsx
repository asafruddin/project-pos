"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse, SalesListResponse } from "@pos-apps/types";
import { DashboardShell } from "@/components/dashboard-shell";
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
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        Memuat…
      </main>
    );
  }

  return (
    <DashboardShell role={me.role}>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        Penjualan
      </h1>
      <p className="text-sm text-muted-foreground">
        Total hari ini (UTC):{" "}
        <span className="font-medium text-foreground">
          {formatIdr(data?.daily_total_minor ?? 0)}
        </span>
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!data || data.sales.length === 0 ? (
        <p className="max-w-lg text-muted-foreground">
          Belum ada penjualan tersinkron. Daftar ini terisi setelah kasir
          mengunggah penjualan selesai — bukan mode offline kasir.
        </p>
      ) : (
        <table className="w-full max-w-2xl border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Waktu</th>
              <th className="py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.sales.map((s) => (
              <tr key={s.sale_id} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(s.completed_at))}
                </td>
                <td className="py-2">{formatIdr(s.amount_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardShell>
  );
}
