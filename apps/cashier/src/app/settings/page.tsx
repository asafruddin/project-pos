"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/templates/app-shell";
import { getStoreIdentity } from "@/lib/auth-token";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import {
  PrinterChooserBlockedError,
  PrinterGestureError,
  PrinterInsecureError,
  PrinterPairCancelledError,
  PrinterReconnectError,
  getBluetoothEnvironment,
  pairBluetoothPrinter,
  printBluetoothTestPage,
  clearSavedBlePrinter,
  getSavedBlePrinter,
  type SavedBlePrinter,
} from "@/lib/printer";

export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [secure, setSecure] = useState(true);
  const [chromeFamily, setChromeFamily] = useState(true);
  const [supported, setSupported] = useState(false);
  const [printer, setPrinter] = useState<SavedBlePrinter | null>(null);
  const [busy, setBusy] = useState<"pair" | "test" | "remove" | null>(null);
  const pairingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    const env = getBluetoothEnvironment();
    setSupported(env.supported);
    setSecure(env.secure);
    setChromeFamily(env.chromeFamily);
    setPrinter(getSavedBlePrinter());
    setReady(true);
  }, [router]);

  function addPrinter() {
    if (pairingRef.current) return;
    pairingRef.current = true;
    let pending: ReturnType<typeof pairBluetoothPrinter>;
    try {
      pending = pairBluetoothPrinter();
    } catch (err) {
      pairingRef.current = false;
      setMessage(null);
      setError(pairErrorCopy(err));
      return;
    }
    setBusy("pair");
    setError(null);
    setMessage(t.printerPairing);
    void pending
      .then((saved) => {
        setPrinter(saved);
        setMessage(t.printerReady.replace("{name}", saved.name));
      })
      .catch((err: unknown) => {
        setMessage(null);
        if (err instanceof PrinterPairCancelledError) {
          setError(null);
          return;
        }
        setError(pairErrorCopy(err));
      })
      .finally(() => {
        pairingRef.current = false;
        setBusy(null);
      });
  }

  function pairErrorCopy(err: unknown): string {
    if (err instanceof PrinterInsecureError) return t.printerInsecure;
    if (err instanceof PrinterChooserBlockedError) return t.printerChooserBlocked;
    if (err instanceof PrinterGestureError) return t.printerGesture;
    return t.printerPairFail;
  }

  async function testPrint() {
    setBusy("test");
    setError(null);
    setMessage(t.printerPrinting);
    try {
      await printBluetoothTestPage(getStoreIdentity().storeName);
      setMessage(t.printerTestOk);
    } catch (err) {
      setMessage(null);
      if (err instanceof PrinterReconnectError) {
        clearSavedBlePrinter();
        setPrinter(null);
        setError(t.printerNeedPairAgain);
        return;
      }
      setError(t.printerTestFail);
    } finally {
      setBusy(null);
    }
  }

  function removePrinter() {
    setBusy("remove");
    clearSavedBlePrinter();
    setPrinter(null);
    setError(null);
    setMessage(t.printerNone);
    setBusy(null);
  }

  if (!ready) {
    return <AuthLoadingShell message={t.loading} />;
  }

  const status = !supported
    ? t.printerUnsupported
    : printer
      ? t.printerReady.replace("{name}", printer.name)
      : t.printerNone;

  const canPair = supported && secure && busy === null;

  return (
    <AppShell
      title={t.settings}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={t.settingsHint}
    >
      <section className="max-w-lg space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t.printerSection}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.printerHint}</p>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{status}</p>
        </div>

        {!chromeFamily ? (
          <p className="text-sm text-warning" role="status">
            {t.printerNeedChrome}
          </p>
        ) : null}
        {!secure ? (
          <p className="text-sm text-warning" role="status">
            {t.printerInsecure}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message && !error ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              addPrinter();
            }}
            onClick={(event) => {
              if (event.detail !== 0) {
                event.preventDefault();
                return;
              }
              addPrinter();
            }}
            disabled={!canPair}
          >
            {busy === "pair" ? t.printerPairing : t.printerAdd}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void testPrint()}
            disabled={!supported || !printer || busy !== null}
          >
            {busy === "test" ? t.printerPrinting : t.printerTest}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={removePrinter}
            disabled={!printer || busy !== null}
          >
            {t.printerRemove}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
