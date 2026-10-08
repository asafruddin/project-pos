"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Button } from "@pos-apps/ui/atoms";
import type { AuthMeResponse, StoreRecord } from "@pos-apps/types";
import { storeLogoFilePath } from "@pos-apps/types";
import { DashboardShell } from "@/components/templates/dashboard-shell";
import { DashboardSkeleton } from "@/components/molecules/dashboard-skeleton";
import { authorizedFetch } from "@/lib/api-client";
import { useAuthorizedImage } from "@/lib/use-authorized-image";
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
  const isLogin = pathname === "/login";
  const [ready, setReady] = useState(isLogin);
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [affiliatedStore, setAffiliatedStore] = useState<StoreRecord | null>(
    null,
  );

  useEffect(() => {
    if (isLogin) {
      setMe(null);
      setAffiliatedStore(null);
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
        setUnreachable(false);
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
        // Network/API down: keep the session. Redirecting to /login here would
        // bounce straight back (login redirects when a valid token exists) and loop.
        setUnreachable(true);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, attempt]);

  useEffect(() => {
    if (isLogin || !me?.store_id) {
      setAffiliatedStore(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await authorizedFetch(`/stores/${me.store_id}`);
        if (!res.ok || cancelled) return;
        setAffiliatedStore((await res.json()) as StoreRecord);
      } catch {
        if (!cancelled) setAffiliatedStore(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin, me?.store_id, pathname]);

  const logoFilePath = affiliatedStore?.logo_secure_url
    ? null
    : affiliatedStore?.logo_public_id
      ? `${storeLogoFilePath(affiliatedStore.store_id)}?v=${encodeURIComponent(affiliatedStore.logo_public_id)}`
      : me?.store_logo_url;
  const proxiedLogo = useAuthorizedImage(logoFilePath);
  const storeLogoSrc = affiliatedStore?.logo_secure_url || proxiedLogo;

  if (isLogin) {
    return children;
  }

  if (unreachable && !me) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">Server tidak dapat dihubungi.</p>
        <p className="text-sm text-muted-foreground">
          Pastikan API berjalan, lalu coba lagi.
        </p>
        <Button
          type="button"
          onClick={() => {
            setUnreachable(false);
            setReady(false);
            setAttempt((n) => n + 1);
          }}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!ready || !me) {
    return <DashboardSkeleton />;
  }

  const storeName =
    affiliatedStore?.name?.trim() || me.store_name?.trim() || "POS Apps";

  return (
    <DashboardSessionContext.Provider value={me}>
      <DashboardShell
        role={me.role}
        permissions={me.permissions}
        storeName={storeName}
        storeLogoSrc={storeLogoSrc}
      >
        {children}
      </DashboardShell>
    </DashboardSessionContext.Provider>
  );
}
