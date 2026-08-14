"use client";

import { AuthLoadingShell, AuthSplitShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enrollPin,
  hasPinMaterial,
  verifyPin,
} from "@pos-apps/local-db";
import { PinPad } from "@/components/organisms/pin-pad";
import { PrefControls } from "@/components/molecules/settings-menu";
import { clearSession, getAccessToken, getSession, isShiftAuthorized } from "@/lib/auth-token";
import { clearPinUnlock, isPinUnlocked, setPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

export default function PinPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"loading" | "enroll" | "unlock" | "blocked">(
    "loading",
  );
  const [offline, setOffline] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();

    async function gate() {
      if (isPinUnlocked()) {
        router.replace("/menu");
        return;
      }
      const session = getSession();

      if (session?.accessToken) {
        const enrolled = await hasPinMaterial(session.userId);
        setOffline(!navigator.onLine);
        setMode(enrolled ? "unlock" : "enroll");
        return;
      }

      if (isShiftAuthorized() && (await hasPinMaterial())) {
        setOffline(true);
        setMode("unlock");
        return;
      }

      setMode("blocked");
    }

    void gate();
  }, [router]);

  async function submitPin(digits: string) {
    if (digits.length !== 6 || submitting.current) return;
    submitting.current = true;
    setError(null);
    setPending(true);
    try {
      const session = getSession();

      if (mode === "enroll") {
        if (!session?.userId || !getAccessToken()) {
          setError(t.pinOfflineNoMaterial);
          setPin("");
          return;
        }
        if (!navigator.onLine) {
          setError(t.pinOfflineNoMaterial);
          setPin("");
          return;
        }
        await enrollPin(session.userId, digits);
        setPinUnlocked(true);
        router.replace("/menu");
        return;
      }

      if (mode === "unlock") {
        if (!(await hasPinMaterial(session?.userId)) && !(await hasPinMaterial())) {
          setError(t.pinOfflineNoMaterial);
          setPin("");
          return;
        }
        const ok = await verifyPin(session?.userId ?? null, digits);
        if (!ok) {
          setError(t.pinWrong);
          setPin("");
          return;
        }
        setPinUnlocked(true);
        router.replace("/menu");
        return;
      }

      setError(t.pinOfflineNoMaterial);
      setPin("");
    } catch {
      setError(t.pinWrong);
      setPin("");
    } finally {
      setPending(false);
      submitting.current = false;
    }
  }

  function logout() {
    clearSession();
    clearPinUnlock();
    router.replace("/login");
  }

  const settings = (
    <PrefControls
      onLangChange={() => setLang(getLang())}
      tooltipSide="bottom"
    />
  );

  if (mode === "loading") {
    return <AuthLoadingShell message={t.loading} />;
  }

  if (mode === "blocked") {
    return (
      <AuthSplitShell
        brandTitle="POS Apps"
        brandSubtitle={t.brand}
        heading={t.pinTitle}
        description={t.pinOfflineNoMaterial}
        quoteBy={t.brand}
        topRight={settings}
      >
        <Button
          type="button"
          className="h-12 min-h-12 w-full rounded-xl"
          onClick={() => router.replace("/login")}
        >
          {t.title}
        </Button>
      </AuthSplitShell>
    );
  }

  const subtitle = `${mode === "enroll" ? t.pinEnrollHint : t.pinUnlockHint}${
    offline ? ` ${t.pinOfflineBadge}` : ""
  }`;

  return (
    <AuthSplitShell
      brandTitle="POS Apps"
      brandSubtitle={t.brand}
      heading={t.pinTitle}
      description={subtitle}
      quoteBy={t.brand}
      topRight={settings}
    >
      <div className="flex flex-col gap-6">
        <PinPad
          value={pin}
          onChange={(next) => {
            setError(null);
            setPin(next);
            if (next.length === 6) void submitPin(next);
          }}
          disabled={pending}
          inputLabel={t.pinInputLabel}
          pasteHint={t.pinPasteHint}
        />

        {error ? (
          <div
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-center text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          className="h-12 min-h-12 w-full rounded-xl"
          disabled={pending || pin.length !== 6}
          onClick={() => void submitPin(pin)}
        >
          {pending ? t.pending : t.pinSubmit}
        </Button>

        {getAccessToken() ? (
          <Button
            type="button"
            variant="link"
            className="text-muted-foreground"
            onClick={logout}
          >
            {t.logout}
          </Button>
        ) : (
          <Button
            type="button"
            variant="link"
            className="text-muted-foreground"
            onClick={() => router.replace("/login")}
          >
            {t.title}
          </Button>
        )}
      </div>
    </AuthSplitShell>
  );
}
