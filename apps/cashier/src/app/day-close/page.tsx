"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDayCloseSummary,
  type DayCloseSummary,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/app-shell";
import { AuthLoadingShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth-token";
import { formatIdr } from "@/lib/money";
import { clearPinUnlock, isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

type Step = "summary" | "report";

export default function DayClosePage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState<DayCloseSummary | null>(null);
  const [step, setStep] = useState<Step>("summary");
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    setSummary(await getDayCloseSummary());
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

  const pending = summary?.pendingSyncCount ?? 0;
  const canContinue = pending === 0 || ack;

  function goToReport() {
    if (!canContinue) {
      setAckError(t.dayCloseAckRequired);
      return;
    }
    setAckError(null);
    setStep("report");
  }

  function finishDayClose() {
    if (!canContinue) {
      setAckError(t.dayCloseAckRequired);
      setStep("summary");
      return;
    }
    setFinishing(true);
    // End Account + PIN session only — keep sales / outbox / PIN material (AD-8).
    clearSession();
    clearPinUnlock();
    router.replace("/login");
  }

  if (!ready || !summary) {
    return <AuthLoadingShell message={t.loading} />;
  }

  const pendingSet = new Set(summary.pendingSyncSaleIds);

  return (
    <AppShell
      title={t.dayClose}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={step === "summary" ? t.dayCloseSummary : t.dayCloseReport}
    >
      {step === "summary" ? (
        <section className="flex max-w-lg flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.dayCloseSalesTotal}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatIdr(summary.totalMinor, lang)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.dayCloseCash}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatIdr(summary.cashMinor, lang)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.dayCloseTxCount}</dt>
              <dd className="mt-1 text-xl font-semibold">{summary.transactionCount}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.waitingUpload}</dt>
              <dd className="mt-1 text-xl font-semibold">{pending}</dd>
            </div>
          </dl>

          {pending === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dayCloseSyncOk}</p>
          ) : (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive" role="alert">
                {pending} {t.dayCloseSyncPending}
              </p>
              <label className="flex min-h-12 cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0"
                  checked={ack}
                  onChange={(e) => {
                    setAck(e.target.checked);
                    setAckError(null);
                  }}
                />
                <span>
                  {t.dayCloseAckLabel.replace("{count}", String(pending))}
                </span>
              </label>
              {ackError ? (
                <p className="text-sm text-destructive" role="alert">
                  {ackError}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="min-h-14 rounded-2xl bg-accent text-accent-foreground hover:opacity-90"
              disabled={!canContinue}
              onClick={goToReport}
            >
              {t.dayCloseContinue}
            </Button>
            <Button
              type="button"
              className="min-h-12 bg-secondary text-secondary-foreground hover:opacity-90"
              onClick={() => router.replace("/menu")}
            >
              {t.dayCloseBack}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex max-w-2xl flex-col gap-4">
          {!canContinue ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {t.dayCloseAckRequired}
            </p>
          ) : null}

          {summary.sales.length === 0 ? (
            <p className="text-muted-foreground">{t.dayCloseEmpty}</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/70">
              {summary.sales.map((sale) => {
                const amount = sale.payment?.amountMinor ?? 0;
                const waiting = pendingSet.has(sale.saleId);
                return (
                  <li
                    key={sale.saleId}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
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
                        {sale.lines
                          .map((l) => `${l.name} ×${l.qty}`)
                          .join(", ")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                          {t.dayCloseStatusDone}
                        </span>
                        {waiting ? (
                          <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {t.waitingUpload}
                          </span>
                        ) : (
                          <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {t.synced}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {sale.lines
                        .map((l) => formatIdr(l.priceMinor * l.qty, lang))
                        .join(" · ")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="flex justify-between text-lg font-semibold">
            <span>{t.total}</span>
            <span>{formatIdr(summary.totalMinor, lang)}</span>
          </p>
          <p className="text-sm text-muted-foreground">{t.dayCloseConfirmHint}</p>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="min-h-14 rounded-2xl bg-accent text-accent-foreground hover:opacity-90"
              disabled={!canContinue || finishing}
              onClick={finishDayClose}
            >
              {finishing ? t.pending : t.dayCloseConfirm}
            </Button>
            <Button
              type="button"
              className="min-h-12 bg-secondary text-secondary-foreground hover:opacity-90"
              disabled={finishing}
              onClick={() => setStep("summary")}
            >
              {t.dayCloseBack}
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
