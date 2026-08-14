"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getAccessToken,
  handleExpiredAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";
import { API_URL } from "@/lib/api-client";

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
