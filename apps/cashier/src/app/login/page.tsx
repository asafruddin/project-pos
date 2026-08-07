"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsMenu } from "@/components/settings-menu";
import { getAccessToken } from "@/lib/auth-token";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (getAccessToken()) {
      router.replace("/pin");
    }
  }, [router]);

  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-6 p-8">
      <div className="flex w-full max-w-sm items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-accent">{t.brand}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {t.title}
          </h1>
          <p className="max-w-md text-muted-foreground">{t.subtitle}</p>
        </div>
        <SettingsMenu onLangChange={() => setLang(getLang())} />
      </div>
      <LoginForm lang={lang} />
    </main>
  );
}
