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
import { StoresPanel } from "../stores-panel";

export default function StoresPage() {
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

  if (!ready || !me) {
    return <DashboardLoading />;
  }

  if (!hasPermission(me.permissions, "stores", "view")) {
    return (
      <DashboardShell
        role={me.role}
        permissions={me.permissions}
        title="Toko"
        subtitle="Hanya Owner/Admin yang menambah toko. Kasir terikat toko dari akun."
      >
        <p className="text-sm text-muted-foreground">
          Checkout tidak memilih toko per baris.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me.role}
      permissions={me.permissions}
      title="Toko"
      subtitle="Store #1 tetap toko awal. Harga toko menimpa harga katalog setelah kasir menyegarkan menu."
    >
      <StoresPanel canEdit={hasPermission(me.permissions, "stores", "update")} />
    </DashboardShell>
  );
}
