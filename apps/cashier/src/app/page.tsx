"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasPinMaterial } from "@pos-apps/local-db";
import { getAccessToken } from "@/lib/auth-token";
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
      if (getAccessToken() || (await hasPinMaterial())) {
        router.replace("/pin");
        return;
      }
      router.replace("/login");
    }

    void route();
  }, [router]);

  return (
    <main className="flex flex-1 items-center p-8 text-muted-foreground">
      Memuat…
    </main>
  );
}
