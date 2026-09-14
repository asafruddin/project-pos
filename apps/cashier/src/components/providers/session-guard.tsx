"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getAccessToken,
  handleExpiredAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
  patchStoreIdentity,
} from "@/lib/auth-token";
import { API_URL } from "@/lib/api-client";
import { prefetchStoreLogo } from "@/lib/use-store-logo";
import type { AuthMeResponse } from "@pos-apps/types";

const CHECK_MS = 30_000;

/**
 * Watches JWT expiry and validates with GET /auth/me while online.
 * Offline: expired token is stripped but shift/PIN continue.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    let cancelled = false;

    async function validateRemote(token: string) {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 401) {
          logoutToLogin();
          return;
        }
        if (res.ok) {
          const me = (await res.json()) as AuthMeResponse;
          if (cancelled) return;
          patchStoreIdentity({
            storeId: me.store_id,
            storeName: me.store_name,
            storeLogoUrl: me.store_logo_url,
          });
          void prefetchStoreLogo(me.store_logo_url);
        }
      } catch {
        // Network errors: do not logout (cashier may be offline).
      }
    }

    function checkLocal() {
      const token = getAccessToken();
      if (!token) return;
      if (isAccessTokenExpired(token)) {
        handleExpiredAccessToken();
        return;
      }
      if (navigator.onLine) {
        void validateRemote(token);
      }
    }

    checkLocal();
    const id = window.setInterval(checkLocal, CHECK_MS);
    const onFocus = () => checkLocal();
    const onOnline = () => checkLocal();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [pathname]);

  return children;
}
