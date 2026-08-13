"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthMeResponse } from "@pos-apps/types";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";
import {
  getAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";

const DashboardSessionContext = createContext<AuthMeResponse | null>(null);

export function useDashboardSession(): AuthMeResponse {
  const me = useContext(DashboardSessionContext);
  if (!me) {
    throw new Error("useDashboardSession must be used inside DashboardFrame");
  }
  return me;
}

/**
 * Keeps auth + sidebar mounted across dashboard routes so only the page
 * content swaps. Login is passed through unchanged.
 */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [ready, setReady] = useState(isLogin);
  const [me, setMe] = useState<AuthMeResponse | null>(null);

  useEffect(() => {
    if (isLogin) {
      setMe(null);
      setReady(true);
      return;
    }

    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      setReady(true);
      logoutToLogin();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await authorizedFetch("/auth/me");
        if (cancelled) return;
        if (!res.ok) {
          logoutToLogin();
          return;
        }
        setMe((await res.json()) as AuthMeResponse);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
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

    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  if (isLogin) {
    return children;
  }

  if (!ready || !me) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardSessionContext.Provider value={me}>
      <DashboardShell role={me.role} permissions={me.permissions}>
        {children}
      </DashboardShell>
    </DashboardSessionContext.Provider>
  );
}
