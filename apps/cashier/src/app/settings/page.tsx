"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/templates/app-shell";
import { getStoreIdentity } from "@/lib/auth-token";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import {
  PrinterPairCancelledError,
  PrinterReconnectError,
  canUseWebBluetooth,
  clearSavedBlePrinter,
  getSavedBlePrinter,
  pairBluetoothPrinter,
  printBluetoothTestPage,
  type SavedBlePrinter,
} from "@/lib/printer";

export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [printer, setPrinter] = useState<SavedBlePrinter | null>(null);
  const [busy, setBusy] = useState<"pair" | "test" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    setSupported(canUseWebBluetooth());
    setPrinter(getSavedBlePrinter());
    setReady(true);
  }, [router]);

  async function addPrinter() {
    setBusy("pair");
    setError(null);
    setMessage(t.printerPairing);
    try {
      const saved = await pairBluetoothPrinter();
      setPrinter(saved);
      setMessage(t.printerReady.replace("{name}", saved.name));
    } catch (err) {
      setMessage(null);
      if (err instanceof PrinterPairCancelledError) {
        setError(t.printerPairCancel);
        return;
      }
      setError(t.printerPairFail);
    } finally {
      setBusy(null);
    }
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
            onClick={() => void addPrinter()}
            disabled={!supported || busy !== null}
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
