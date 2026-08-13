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
import { OpnamePanel } from "../opname-panel";

export default function OpnamePage() {
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

  if (!hasPermission(me.permissions, "inventory", "view")) {
    return (
      <DashboardShell
        role={me.role} permissions={me.permissions}
        title="Opname stok"
        subtitle="Hanya staf dengan izin stok yang dapat membuat dan menyetujui opname."
      >
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki alur opname. Gunakan Ikhtisar stok untuk melihat jumlah.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me.role} permissions={me.permissions}
      title="Opname stok"
      subtitle="Hitung fisik, lihat selisih, lalu setujui. Draf tidak mengubah stok."
    >
      <OpnamePanel
        canMutate={
          hasPermission(me.permissions, "inventory", "create") ||
          hasPermission(me.permissions, "inventory", "update")
        }
        canApprove={hasPermission(me.permissions, "inventory", "approve")}
      />
    </DashboardShell>
  );
}
