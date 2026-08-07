"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enrollPin,
  hasPinMaterial,
  verifyPin,
} from "@pos-apps/local-db";
import { PinPad } from "@/components/pin-pad";
import { Button } from "@/components/ui/button";
import { SettingsMenu } from "@/components/settings-menu";
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

      // Offline mid-shift: prior Account Login (shift flag) + PIN material (FR5).
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

  if (mode === "loading") {
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        {t.loading}
      </main>
    );
  }

  if (mode === "blocked") {
    return (
      <main className="flex flex-1 flex-col items-start justify-center gap-6 p-8">
        <div className="flex w-full max-w-md items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-accent">{t.brand}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-primary">
              {t.pinTitle}
            </h1>
            <p className="max-w-md text-muted-foreground" role="alert">
              {t.pinOfflineNoMaterial}
            </p>
          </div>
          <SettingsMenu onLangChange={() => setLang(getLang())} />
        </div>
        <Button type="button" onClick={() => router.replace("/login")}>
          {t.title}
        </Button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-6 p-8">
      <div className="flex w-full max-w-md items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-accent">{t.brand}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {t.pinTitle}
          </h1>
          <p className="max-w-md text-muted-foreground">
            {mode === "enroll" ? t.pinEnrollHint : t.pinUnlockHint}
            {offline ? ` ${t.pinOfflineBadge}` : ""}
          </p>
        </div>
        <SettingsMenu onLangChange={() => setLang(getLang())} />
      </div>

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
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          disabled={pending || pin.length !== 6}
          onClick={() => void submitPin(pin)}
        >
          {pending ? t.pending : t.pinSubmit}
        </Button>
        {getAccessToken() ? (
          <Button type="button" onClick={logout}>
            {t.logout}
          </Button>
        ) : (
          <Button type="button" onClick={() => router.replace("/login")}>
            {t.title}
          </Button>
        )}
      </div>
    </main>
  );
}
