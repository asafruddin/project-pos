"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@pos-apps/types";
import {
  DashboardLoading,
  DashboardShell,
} from "@/components/dashboard-shell";
import { clearSession, getAccessToken } from "@/lib/auth-token";
import { ProductsPanel } from "./products-panel";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<AuthMeResponse | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setReady(true);
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          clearSession();
          setReady(true);
          router.replace("/login");
          return;
        }
        setMe((await res.json()) as AuthMeResponse);
        setReady(true);
      } catch {
        clearSession();
        setReady(true);
        router.replace("/login");
      }
    })();
  }, [router]);

  if (!ready) {
    return <DashboardLoading />;
  }

  if (!me) {
    return <DashboardLoading message="Mengalihkan ke masuk…" />;
  }

  return (
    <DashboardShell
      role={me.role}
      title="Stok / Produk"
      subtitle="Kelola katalog toko. Harga dalam Rupiah penuh (mis. 15000 = Rp15.000)."
    >
      <ProductsPanel canMutate={me.role === "catalog_admin"} />
    </DashboardShell>
  );
}
