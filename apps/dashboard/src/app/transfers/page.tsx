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
import { TransfersPanel } from "../transfers-panel";

export default function TransfersPage() {
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

  if (!hasPermission(me.permissions, "transfers", "view")) {
    return (
      <DashboardShell
        role={me.role}
        permissions={me.permissions}
        title="Transfer stok"
        subtitle="Transfer tidak masuk Checkout."
      >
        <p className="text-sm text-muted-foreground">Anda tidak memiliki izin transfer.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me.role}
      permissions={me.permissions}
      title="Transfer stok"
      subtitle="Draft → requested → approved → preparing → shipped → received. Stok baru pindah saat dikirim/diterima. Checkout tidak berubah."
    >
      <TransfersPanel
        canCreate={hasPermission(me.permissions, "transfers", "create")}
        canAdvance={hasPermission(me.permissions, "transfers", "update")}
        canApprove={hasPermission(me.permissions, "transfers", "approve")}
      />
    </DashboardShell>
  );
}
