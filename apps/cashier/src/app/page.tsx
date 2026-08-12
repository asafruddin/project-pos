"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoadingShell } from "@/components/auth-shell";
import { getAccessToken, isShiftAuthorized } from "@/lib/auth-token";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, getLang } from "@/lib/preferences";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();

    async function route() {
      if (isPinUnlocked()) {
        router.replace("/menu");
        return;
      }
      // PIN only after Account Login this shift (token or shift flag) — not bare PIN material (FR4).
      if (getAccessToken() || isShiftAuthorized()) {
        router.replace("/pin");
        return;
      }
      router.replace("/login");
    }

    void route();
  }, [router]);

  return <AuthLoadingShell message="Memuat…" />;
}
