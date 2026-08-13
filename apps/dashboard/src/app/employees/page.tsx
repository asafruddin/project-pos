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
import { EmployeesPanel } from "../employees-panel";

export default function EmployeesPage() {
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

  if (!hasPermission(me.permissions, "users", "view")) {
    return (
      <DashboardShell
        role={me.role}
        permissions={me.permissions}
        title="Karyawan"
        subtitle="Hanya Owner dan Admin yang membuka Karyawan / Akses."
      >
        <p className="text-sm text-muted-foreground">
          API menolak user-admin dari token kasir. Hide/show UI saja tidak cukup.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me.role}
      permissions={me.permissions}
      title="Karyawan"
      subtitle="Pengguna, peran, dan matriks izin. Perubahan izin berlaku pada permintaan API berikutnya."
    >
      <EmployeesPanel actorRole={me.role} permissions={me.permissions} />
    </DashboardShell>
  );
}
