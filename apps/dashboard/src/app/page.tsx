"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@pos-apps/types";
import { DashboardShell } from "@/components/dashboard-shell";
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
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        Memuat…
      </main>
    );
  }

  if (!me) {
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        Mengalihkan ke masuk…
      </main>
    );
  }

  return (
    <DashboardShell role={me.role}>
      <h1 className="text-3xl font-semibold tracking-tight text-primary">
        Stok / Produk
      </h1>
      <ProductsPanel canMutate={me.role === "catalog_admin"} />
    </DashboardShell>
  );
}
