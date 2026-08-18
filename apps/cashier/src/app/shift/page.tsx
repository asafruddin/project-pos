"use client";

import { Button, Input, Label, Skeleton } from "@pos-apps/ui/atoms";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ShiftDetailResponse, ShiftExpectedCash } from "@pos-apps/types";
import {
  closeLocalShift,
  computeLocalExpectedCash,
  getOpenShift,
  recordLocalCashMovement,
  type LocalShiftRecord,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { authorizedFetch } from "@/lib/api-client";
import { clearSession } from "@/lib/auth-token";
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
  const [inAmount, setInAmount] = useState("");
  const [inReason, setInReason] = useState("");
  const [outAmount, setOutAmount] = useState("");
  const [outReason, setOutReason] = useState("");
  const [refundsMinor, setRefundsMinor] = useState(0);
  const [counted, setCounted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (row) setExpected(await computeLocalExpectedCash(row, refunds));
    else setExpected(null);
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
      if (!(await getOpenShift())) {
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

  async function onCash(
    kind: "in" | "out",
    amountRaw: string,
    reason: string,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const amount = parseGroupedInt(amountRaw);
    try {
      await recordLocalCashMovement({
        kind,
        amountMinor: Number.isFinite(amount) ? amount : 0,
        reason,
      });
      if (kind === "in") {
        setInAmount("");
        setInReason("");
      } else {
        setOutAmount("");
        setOutReason("");
      }
      await refresh();
      await flushSalesAndVoids();
    } catch {
      setError(t.shiftCashFail);
    } finally {
      setBusy(false);
    }
  }

  async function onClose(e: FormEvent) {
    e.preventDefault();
    if (busy || !expected) return;
    const countedMinor = parseGroupedInt(counted);
    if (!Number.isInteger(countedMinor) || countedMinor < 0) {
      setError(t.shiftCloseFail);
      return;
    }
    const difference = countedMinor - expected.expected_cash_minor;
    if (difference !== 0 && !window.confirm(t.shiftCloseWarn)) return;
    setBusy(true);
    setError(null);
    try {
      await closeLocalShift(countedMinor, { cashRefundsMinor: refundsMinor });
      setCounted("");
      await flushSalesAndVoids();
      notifyShiftChanged();
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
      await refresh();
      router.replace("/day-close");
    } catch {
      setError(t.shiftCloseFail);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !current || !expected) {
    return (
      <ShiftShell lang={lang} onLangChange={() => setLang(getLang())}>
        <ShiftLoadingContent message={t.loading} />
      </ShiftShell>
    );
  }

  const difference =
    expected && Number.isInteger(parseGroupedInt(counted))
      ? parseGroupedInt(counted) - expected.expected_cash_minor
      : null;

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
          <dl className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary/50 p-3 text-sm">
            <dt className="text-muted-foreground">{t.shiftOpening}</dt>
            <dd className="text-right font-medium">
              {formatIdr(expected.opening_cash_minor, lang)}
            </dd>
            <dt className="text-muted-foreground">{t.shiftCashSales}</dt>
            <dd className="text-right">
              {formatIdr(expected.cash_sales_minor, lang)}
            </dd>
            <dt className="text-muted-foreground">{t.shiftCashIn}</dt>
            <dd className="text-right">
              {formatIdr(expected.cash_in_minor, lang)}
            </dd>
            <dt className="text-muted-foreground">{t.shiftCashOut}</dt>
            <dd className="text-right">
              −{formatIdr(expected.cash_out_minor, lang)}
            </dd>
            <dt className="text-muted-foreground">{t.shiftRefunds}</dt>
            <dd className="text-right">
              −{formatIdr(expected.cash_refunds_minor, lang)}
            </dd>
            <dt className="text-muted-foreground">{t.shiftVoids}</dt>
            <dd className="text-right">
              −{formatIdr(expected.cash_voids_minor, lang)}
            </dd>
            <dt className="font-medium">{t.shiftExpected}</dt>
            <dd className="text-right font-semibold">
              {formatIdr(expected.expected_cash_minor, lang)}
            </dd>
          </dl>

          <form
            className="space-y-2 rounded-2xl border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onCash("in", inAmount, inReason);
            }}
          >
            <p className="text-sm font-medium">{t.shiftCashIn}</p>
            <Input
              inputMode="numeric"
              placeholder={t.shiftCashAmount}
              value={inAmount}
              onChange={(e) => setInAmount(e.target.value)}
            />
            <Input
              placeholder={t.shiftCashReason}
              value={inReason}
              onChange={(e) => setInReason(e.target.value)}
            />
            <Button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-2xl bg-secondary text-secondary-foreground"
            >
              {t.shiftCashIn}
            </Button>
          </form>

          <form
            className="space-y-2 rounded-2xl border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onCash("out", outAmount, outReason);
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

          <form
            className="space-y-2 rounded-2xl border border-border p-3"
            onSubmit={(e) => void onClose(e)}
          >
            <Label htmlFor="counted-cash">{t.shiftCounted}</Label>
            <Input
              id="counted-cash"
              inputMode="numeric"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
            {difference !== null ? (
              <p className="text-sm text-muted-foreground">
                {t.shiftDifference}: {formatIdr(difference, lang)}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={busy}
              className="h-12 min-h-12 w-full rounded-xl"
            >
              {busy ? t.pending : closeLabel}
            </Button>
          </form>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

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
