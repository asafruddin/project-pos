"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";
import { API_URL } from "@/lib/api-client";

const CHECK_MS = 30_000;

/**
 * Watches JWT expiry and validates with GET /auth/me.
 * Invalid/expired → clear session and redirect to /login.
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
        // Ignore transient network errors.
      }
    }

    function check() {
      const token = getAccessToken();
      if (!token) return;
      if (isAccessTokenExpired(token)) {
        logoutToLogin();
        return;
      }
      void validateRemote(token);
    }

    check();
    const id = window.setInterval(check, CHECK_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  return children;
}
