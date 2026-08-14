"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Checkbox, Label } from "@pos-apps/ui/atoms";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dayCloseGate,
  getDayCloseSummary,
  type DayCloseSummary,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
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
  const gate = useMemo(() => {
    if (!summary) return { ok: false as const, code: "DAY_CLOSE_SHIFT_OPEN" as const, message: "" };
    return dayCloseGate(summary, ack);
  }, [summary, ack]);
  const canContinue = gate.ok;

  function gateMessage(): string {
    if (gate.ok) return "";
    if (gate.code === "DAY_CLOSE_SHIFT_OPEN") return t.dayCloseShiftOpen;
    if (gate.code === "DAY_CLOSE_SHIFT_REQUIRED") return t.dayCloseShiftRequired;
    return t.dayCloseAckRequired;
  }

  function goToReport() {
    if (!canContinue) {
      setAckError(gateMessage());
      return;
    }
    setAckError(null);
    setStep("report");
  }

  function finishDayClose() {
    if (!canContinue) {
      setAckError(gateMessage());
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
  const shiftBlock =
    !gate.ok &&
    (gate.code === "DAY_CLOSE_SHIFT_OPEN" ||
      gate.code === "DAY_CLOSE_SHIFT_REQUIRED");

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
              <dt className="text-sm text-muted-foreground">{t.dayCloseTxCount}</dt>
              <dd className="mt-1 text-xl font-semibold">{summary.transactionCount}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.waitingUpload}</dt>
              <dd className="mt-1 text-xl font-semibold">{pending}</dd>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <dt className="text-sm text-muted-foreground">{t.dayCloseCash}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatIdr(summary.shiftCountedTotalMinor, lang)}
              </dd>
            </div>
          </dl>

          <div className="space-y-2 rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-sm font-medium">{t.dayCloseCash}</p>
            {summary.closedShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.dayCloseNoShifts}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.closedShifts.map((row) => (
                  <li key={row.shiftId} className="rounded-xl border border-border px-3 py-2">
                    <p className="text-muted-foreground">
                      {new Date(row.closedAt).toLocaleTimeString(
                        lang === "en" ? "en-US" : "id-ID",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                    <p>
                      {t.dayCloseShiftExpected}: {formatIdr(row.expectedCashMinor, lang)}
                    </p>
                    <p>
                      {t.dayCloseShiftCounted}: {formatIdr(row.countedCashMinor, lang)}
                    </p>
                    <p>
                      {t.dayCloseShiftDiff}: {formatIdr(row.differenceMinor, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {summary.closedShifts.length > 1 ? (
              <p className="text-sm font-medium">
                {t.dayCloseShiftCounted}: {formatIdr(summary.shiftCountedTotalMinor, lang)}
                {" · "}
                {t.dayCloseShiftDiff}: {formatIdr(summary.shiftDifferenceTotalMinor, lang)}
              </p>
            ) : null}
          </div>

          {shiftBlock ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive" role="alert">
                {gateMessage()}
              </p>
              <Button
                type="button"
                className="min-h-12 rounded-2xl bg-accent text-accent-foreground"
                onClick={() => router.push("/shift")}
              >
                {t.dayCloseGoShift}
              </Button>
            </div>
          ) : pending === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dayCloseSyncOk}</p>
          ) : (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive" role="alert">
                {pending} {t.dayCloseSyncPending}
              </p>
              <Label className="flex min-h-12 cursor-pointer items-start gap-3 font-normal">
                <Checkbox
                  className="mt-1"
                  checked={ack}
                  onCheckedChange={(checked) => {
                    setAck(checked === true);
                    setAckError(null);
                  }}
                />
                <span>
                  {t.dayCloseAckLabel.replace("{count}", String(pending))}
                </span>
              </Label>
              {ackError ? (
                <p className="text-sm text-destructive" role="alert">
                  {ackError}
                </p>
              ) : null}
            </div>
          )}

          {!shiftBlock && ackError ? (
            <p className="text-sm text-destructive" role="alert">
              {ackError}
            </p>
          ) : null}

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
              {gateMessage()}
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
                          {sale.voidedAt ? t.voided : t.dayCloseStatusDone}
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
