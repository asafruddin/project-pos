"use client";

import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ShiftDetailResponse, ShiftExpectedCash } from "@pos-apps/types";
import {
  buildLocalShiftReport,
  closeLocalShiftAuto,
  computeLocalExpectedCash,
  getOpenShift,
  listShiftCashMovements,
  recordLocalCashMovement,
  type LocalCashMovementRecord,
  type LocalShiftRecord,
  type ShiftReport,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { authorizedFetch } from "@/lib/api-client";
import { clearSession, getStoreIdentity } from "@/lib/auth-token";
import { formatIdr, parseGroupedInt } from "@/lib/money";
import { clearPinUnlock, isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang, type LangPref } from "@/lib/preferences";
import { notifyShiftChanged } from "@/lib/shift-events";

type ShiftIntent = "logout" | "close-then-open" | null;

function parseIntent(raw: string | null): ShiftIntent {
  if (raw === "logout" || raw === "close-then-open") return raw;
  return null;
}

function ShiftLoadingContent({ message }: { message: string }) {
  return (
    <div className="max-w-lg space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

function ShiftShell({
  lang,
  onLangChange,
  subtitle,
  children,
}: {
  lang: LangPref;
  onLangChange: () => void;
  subtitle?: string;
  children: ReactNode;
}) {
  const t = copy(lang);
  return (
    <AppShell
      title={t.shiftTitle}
      lang={lang}
      onLangChange={onLangChange}
      subtitle={subtitle ?? t.loading}
    >
      {children}
    </AppShell>
  );
}

function ShiftPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = parseIntent(searchParams.get("intent"));
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<LocalShiftRecord | null>(null);
  const [expected, setExpected] = useState<ShiftExpectedCash | null>(null);
  const [outAmount, setOutAmount] = useState("");
  const [outReason, setOutReason] = useState("");
  const [refundsMinor, setRefundsMinor] = useState(0);
  const [cashOuts, setCashOuts] = useState<LocalCashMovementRecord[]>([]);
  const [totals, setTotals] = useState<ShiftReport["totals"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    expectedMinor: number;
    file: { blob: Blob; fileName: string } | null;
    message: string | null;
  } | null>(null);
  const [sharing, setSharing] = useState(false);
  const resultRef = useRef(false);

  const refresh = useCallback(async () => {
    const row = await getOpenShift();
    setCurrent(row);
    let refunds = 0;
    if (row && navigator.onLine) {
      try {
        const res = await authorizedFetch(`/shifts/${row.shiftId}`);
        if (res.ok) {
          const data = (await res.json()) as ShiftDetailResponse;
          refunds = data.expected.cash_refunds_minor;
        }
      } catch {
        /* local formula without server refunds */
      }
    }
    setRefundsMinor(refunds);
    if (row) {
      setExpected(await computeLocalExpectedCash(row, refunds));
      setCashOuts((await listShiftCashMovements(row.shiftId)).filter((m) => m.kind === "out"));
      // Sales so far by payment method (same totals as the PDF; voided sales excluded).
      const report = await buildLocalShiftReport(row, {
        storeName: getStoreIdentity().storeName,
        cashRefundsMinor: refunds,
        refundsKnown: navigator.onLine,
      });
      setTotals(report.totals);
    } else {
      setExpected(null);
      setCashOuts([]);
      setTotals(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    void (async () => {
      await refresh();
      if (!(await getOpenShift()) && !resultRef.current) {
        if (intent === "logout") {
          clearSession();
          clearPinUnlock();
          router.replace("/login");
          return;
        }
        router.replace("/menu");
      }
    })();
  }, [router, refresh, intent]);

  // A cash out typed but not yet saved: the amount is required, the reason is optional.
  const typedAmount = parseGroupedInt(outAmount);
  const hasPendingOut = outAmount.trim() !== "" || outReason.trim() !== "";
  const pendingOutMinor =
    Number.isInteger(typedAmount) && typedAmount > 0 ? typedAmount : 0;

  /** A blank reason is stored as "Kas keluar" (the server requires a non-empty reason). */
  function saveCashOutRow() {
    return recordLocalCashMovement({
      kind: "out",
      amountMinor: pendingOutMinor,
      reason: outReason.trim() || t.shiftCashOut,
    });
  }

  async function onCash() {
    if (busy) return;
    setError(null);
    if (pendingOutMinor < 1) {
      setError(t.shiftCashAmountRequired);
      return;
    }
    setBusy(true);
    try {
      await saveCashOutRow();
      setOutAmount("");
      setOutReason("");
      await refresh();
      await flushSalesAndVoids();
    } catch {
      setError(t.shiftCashFail);
    } finally {
      setBusy(false);
    }
  }

  async function onClose() {
    if (busy || !expected || !current) return;
    setError(null);
    if (hasPendingOut && pendingOutMinor < 1) {
      setError(t.shiftCashAmountRequired);
      return;
    }
    if (!window.confirm(t.shiftCloseConfirm)) return;
    setBusy(true);
    try {
      // Auto-save a cash out that was typed but not submitted, so the final cash includes it.
      if (hasPendingOut) {
        await saveCashOutRow();
        setOutAmount("");
        setOutReason("");
      }
      // Counted cash = the system's expected cash: nothing is typed at close.
      const closed = await closeLocalShiftAuto({ cashRefundsMinor: refundsMinor });
      await flushSalesAndVoids();
      notifyShiftChanged();
      // The shift is closed for good; a PDF problem only shows a message, it never undoes the close.
      let file: { blob: Blob; fileName: string } | null = null;
      let message: string | null = null;
      try {
        const report = await buildLocalShiftReport(closed, {
          storeName: getStoreIdentity().storeName,
          cashRefundsMinor: refundsMinor,
          refundsKnown: navigator.onLine,
        });
        const { shiftReportPdfFile } = await import("@/lib/shift-report-pdf");
        file = shiftReportPdfFile(report, lang);
      } catch {
        message = t.shiftPdfFail;
      }
      resultRef.current = true;
      setResult({ expectedMinor: closed.expectedCashMinor ?? expected.expected_cash_minor, file, message });
    } catch {
      setError(t.shiftCloseFail);
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    if (!result?.file || sharing) return;
    setSharing(true);
    try {
      const { shareShiftPdf } = await import("@/lib/shift-report-pdf");
      await shareShiftPdf(result.file);
      setResult({ ...result, message: null });
    } catch {
      setResult({ ...result, message: t.shiftShareFail });
    } finally {
      setSharing(false);
    }
  }

  async function onDone() {
    if (intent === "logout") {
      clearSession();
      clearPinUnlock();
      router.replace("/login");
      return;
    }
    if (intent === "close-then-open") {
      router.replace("/menu");
      return;
    }
    router.replace("/day-close");
  }

  if (result) {
    return (
      <ShiftShell lang={lang} onLangChange={() => setLang(getLang())} subtitle={t.shiftClosedTitle}>
        <div className="max-w-lg space-y-4">
          <div className="space-y-1 rounded-2xl border border-border bg-secondary/50 p-4">
            <p className="text-base font-semibold">{t.shiftClosedTitle}</p>
            <p className="text-sm text-muted-foreground">{t.shiftFinalCash}</p>
            <p className="text-3xl font-bold">{formatIdr(result.expectedMinor, lang)}</p>
            {result.file ? (
              <p className="text-sm text-muted-foreground">{t.shiftPdfReady}</p>
            ) : null}
            {result.message ? (
              <p className="text-sm text-destructive" role="alert">
                {result.message}
              </p>
            ) : null}
          </div>
          {result.file ? (
            <Button
              type="button"
              disabled={sharing}
              className="h-12 min-h-12 w-full rounded-xl"
              onClick={() => void onShare()}
            >
              {sharing ? t.pending : t.shiftSharePdf}
            </Button>
          ) : null}
          <Button
            type="button"
            className="min-h-12 w-full rounded-2xl bg-secondary text-secondary-foreground"
            onClick={() => void onDone()}
          >
            {t.shiftDone}
          </Button>
        </div>
      </ShiftShell>
    );
  }

  if (!ready || !current || !expected) {
    return (
      <ShiftShell lang={lang} onLangChange={() => setLang(getLang())}>
        <ShiftLoadingContent message={t.loading} />
      </ShiftShell>
    );
  }

  const subtitle =
    intent === "logout"
      ? t.shiftLogoutHint
      : intent === "close-then-open"
        ? t.shiftResumeHint
        : t.shiftActive;

  const closeLabel =
    intent === "logout"
      ? t.shiftLogoutClose
      : intent === "close-then-open"
        ? t.shiftResumeClose
        : t.shiftClose;

  return (
    <ShiftShell
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={subtitle}
    >
      <div className="max-w-lg space-y-5">
          <section className="space-y-4 rounded-2xl border border-border bg-secondary/50 p-5">
            <h2 className="text-xl font-bold">{t.shiftSummary}</h2>

            <dl className="space-y-2">
              <dt className="text-sm font-semibold text-muted-foreground">{t.shiftSectionCash}</dt>
              {(
                [
                  [t.shiftOpening, formatIdr(expected.opening_cash_minor, lang)],
                  ...(expected.cash_in_minor > 0
                    ? ([[t.shiftCashIn, formatIdr(expected.cash_in_minor, lang)]] as Array<[string, string]>)
                    : []),
                  [t.shiftCashOut, `−${formatIdr(expected.cash_out_minor + pendingOutMinor, lang)}`],
                  [t.shiftRefunds, `−${formatIdr(expected.cash_refunds_minor, lang)}`],
                  [t.shiftVoids, `−${formatIdr(expected.cash_voids_minor, lang)}`],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 text-base">
                  <dd>{label}</dd>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <dl className="space-y-2 border-t border-border pt-4">
              <dt className="text-sm font-semibold text-muted-foreground">{t.shiftSectionSales}</dt>
              {(
                [
                  [t.shiftMethodCash, totals?.cashMinor ?? 0],
                  [t.qris, totals?.qrisMinor ?? 0],
                  ...((totals?.storeCreditMinor ?? 0) > 0
                    ? ([[t.storeCredit, totals?.storeCreditMinor ?? 0]] as Array<[string, number]>)
                    : []),
                ] as Array<[string, number]>
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between py-1 text-base">
                  <dd>{label}</dd>
                  <dd className="tabular-nums">{formatIdr(amount, lang)}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{t.shiftGrandTotal}</p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatIdr(
                    expected.opening_cash_minor +
                      (totals?.totalMinor ?? 0) +
                      expected.cash_in_minor -
                      expected.cash_out_minor -
                      pendingOutMinor -
                      expected.cash_refunds_minor,
                    lang,
                  )}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{t.shiftGrandTotalHint}</p>
            </div>
          </section>

          <p className="text-sm text-muted-foreground">{t.shiftAutoNote}</p>

          <form
            className="space-y-2 rounded-2xl border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onCash();
            }}
          >
            <p className="text-sm font-medium">{t.shiftCashOut}</p>
            <Input
              inputMode="numeric"
              placeholder={t.shiftCashAmount}
              value={outAmount}
              onChange={(e) => setOutAmount(e.target.value)}
            />
            <Input
              placeholder={t.shiftCashReason}
              value={outReason}
              onChange={(e) => setOutReason(e.target.value)}
            />
            <Button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-2xl bg-secondary text-secondary-foreground"
            >
              {t.shiftCashOut}
            </Button>
          </form>

          <div className="space-y-1 rounded-2xl border border-border p-3 text-sm">
            <p className="font-medium">{t.shiftCashOutList}</p>
            {cashOuts.length === 0 ? (
              <p className="text-muted-foreground">{t.shiftCashOutEmpty}</p>
            ) : (
              cashOuts.map((m) => (
                <div key={m.movementId} className="flex justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.reason}</span>
                  <span>−{formatIdr(m.amountMinor, lang)}</span>
                </div>
              ))
            )}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={busy}
            className="h-12 min-h-12 w-full rounded-xl"
            onClick={() => void onClose()}
          >
            {busy ? t.pending : closeLabel}
          </Button>

          {intent ? null : (
            <Button
              type="button"
              className="min-h-12 w-full rounded-2xl bg-secondary text-secondary-foreground"
              onClick={() => router.push("/menu")}
            >
              {t.shiftToMenu}
            </Button>
          )}
        </div>
    </ShiftShell>
  );
}

export default function ShiftPage() {
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  return (
    <Suspense
      fallback={
        <ShiftShell lang={lang} onLangChange={() => setLang(getLang())}>
          <ShiftLoadingContent message={t.loading} />
        </ShiftShell>
      }
    >
      <ShiftPageInner />
    </Suspense>
  );
}
