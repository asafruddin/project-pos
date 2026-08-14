"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enrollManagerPin,
  hasManagerPin,
  listCompleteSalesForLocalDay,
  verifyManagerPin,
  verifyPin,
  voidCompleteSale,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
import { PinPad } from "@/components/organisms/pin-pad";
import { getSession } from "@/lib/auth-token";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

export default function VoidPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [sales, setSales] = useState<LocalSaleRecord[]>([]);
  const [target, setTarget] = useState<LocalSaleRecord | null>(null);
  const [pinMode, setPinMode] = useState<"enroll" | "unlock" | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    setSales(await listCompleteSalesForLocalDay());
  }, []);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    void load().then(() => setReady(true));
  }, [router, load]);

  async function startVoid(sale: LocalSaleRecord) {
    if (sale.voidedAt) return;
    setError(null);
    setStatus(null);
    setPin("");
    setTarget(sale);
    const session = getSession();
    const unattended = (session?.permissions ?? []).includes("sales:void_unattended");
    if (unattended) {
      setBusy(true);
      try {
        await voidCompleteSale(sale.saleId);
        setTarget(null);
        setPinMode(null);
        setStatus(t.voidOk);
        await load();
        await flushSalesAndVoids();
        await load();
      } catch {
        setError(t.voidFail);
      } finally {
        setBusy(false);
      }
      return;
    }
    setPinMode((await hasManagerPin()) ? "unlock" : "enroll");
  }

  async function submitManagerPin(digits: string) {
    if (digits.length !== 6 || submitting.current || !target) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = getSession();
      if (pinMode === "enroll") {
        if (session?.userId && (await verifyPin(session.userId, digits))) {
          setError(t.voidPinSame);
          setPin("");
          return;
        }
        await enrollManagerPin(digits);
      } else if (!(await verifyManagerPin(digits))) {
        setError(t.pinWrong);
        setPin("");
        return;
      }
      await voidCompleteSale(target.saleId);
      setTarget(null);
      setPinMode(null);
      setPin("");
      setStatus(t.voidOk);
      await load();
      await flushSalesAndVoids();
      await load();
    } catch {
      setError(t.voidFail);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pin.length === 6 && pinMode) void submitManagerPin(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit when 6 digits entered
  }, [pin, pinMode]);

  if (!ready) {
    return <AuthLoadingShell message={t.loading} />;
  }

  return (
    <AppShell
      title={t.voidTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={t.voidHint}
    >
      {status ? (
        <p className="mb-4 rounded-2xl border border-border bg-secondary/70 p-3 text-sm" role="status">
          {status}
        </p>
      ) : null}
      {error && !pinMode ? (
        <p
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.voidEmpty}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {sales.map((sale) => {
            const amount = sale.payment?.amountMinor ?? 0;
            const voided = Boolean(sale.voidedAt);
            return (
              <li
                key={sale.saleId}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatIdr(amount, lang)}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {sale.completedAt
                        ? new Date(sale.completedAt).toLocaleTimeString(
                            lang === "en" ? "en-US" : "id-ID",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : ""}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sale.lines.map((line) => `${line.name} ×${line.qty}`).join(", ")}
                  </p>
                </div>
                {voided ? (
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs">{t.voided}</span>
                ) : (
                  <Button
                    type="button"
                    disabled={busy}
                    className="min-h-12 rounded-2xl bg-secondary text-secondary-foreground hover:opacity-90"
                    onClick={() => void startVoid(sale)}
                  >
                    {t.voidAction}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pinMode && target ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.voidNeedPin}
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-xl">
            <p className="font-medium">{t.voidNeedPin}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pinMode === "enroll" ? t.voidPinEnroll : t.voidPinUnlock}
            </p>
            {error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4">
              <PinPad
                value={pin}
                onChange={setPin}
                disabled={busy}
                inputLabel={t.pinInputLabel}
                pasteHint={t.pinPasteHint}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="mt-4 h-12 min-h-12 w-full text-sm text-muted-foreground"
              onClick={() => {
                setPinMode(null);
                setTarget(null);
                setPin("");
                setError(null);
              }}
            >
              {t.voidPinCancel}
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
