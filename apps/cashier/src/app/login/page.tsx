"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthSplitShell } from "@/components/auth-shell";
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
    <AuthSplitShell
      brandTitle="POS Apps"
      brandSubtitle={t.brand}
      heading={t.title}
      description={t.subtitle}
      quoteBy={t.brand}
      topRight={<SettingsMenu onLangChange={() => setLang(getLang())} />}
    >
      <LoginForm lang={lang} />
    </AuthSplitShell>
  );
}
