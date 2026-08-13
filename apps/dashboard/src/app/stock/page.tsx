"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";
import {
  DashboardLoading,
  DashboardShell,
} from "@/components/dashboard-shell";
import { authorizedFetch } from "@/lib/api-client";
import {
  getAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";
import { StockOverviewPanel } from "../stock-overview-panel";

export default function StockPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<AuthMeResponse | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      setReady(true);
      logoutToLogin();
      return;
    }

    void (async () => {
      try {
        const res = await authorizedFetch("/auth/me");
        if (!res.ok) {
          logoutToLogin();
          return;
        }
        setMe((await res.json()) as AuthMeResponse);
        setReady(true);
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === "AUTH_UNAUTHORIZED" ||
            err.message === "AUTH_SESSION_EXPIRED")
        ) {
          return;
        }
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
      role={me.role} permissions={me.permissions}
      title="Ikhtisar stok"
      subtitle="Jumlah dijual dan rusak dari buku besar. Kasir tetap bisa menjual meski stok habis."
    >
      <StockOverviewPanel canMutate={hasPermission(me.permissions, "inventory", "update")} />
    </DashboardShell>
  );
}
