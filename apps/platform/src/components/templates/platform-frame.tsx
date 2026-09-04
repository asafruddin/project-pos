"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PlatformAuthMeResponse } from "@pos-apps/types";
import { PlatformShell } from "@/components/templates/platform-shell";
import { DashboardSkeleton } from "@/components/molecules/dashboard-skeleton";
import { authorizedFetch } from "@/lib/api-client";
import {
  getAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";

const PlatformSessionContext = createContext<PlatformAuthMeResponse | null>(
  null,
);

export function usePlatformSession(): PlatformAuthMeResponse {
  const me = useContext(PlatformSessionContext);
  if (!me) {
    throw new Error("usePlatformSession must be used inside PlatformFrame");
  }
  return me;
}

export function PlatformFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [ready, setReady] = useState(isLogin);
  const [me, setMe] = useState<PlatformAuthMeResponse | null>(null);

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
        const res = await authorizedFetch("/platform/auth/me");
        if (cancelled) return;
        if (!res.ok) {
          logoutToLogin();
          return;
        }
        setMe((await res.json()) as PlatformAuthMeResponse);
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
    <PlatformSessionContext.Provider value={me}>
      <PlatformShell role={me.role}>{children}</PlatformShell>
    </PlatformSessionContext.Provider>
  );
}
