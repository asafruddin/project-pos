"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Input, Label } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import { notifyShiftChanged } from "@/lib/shift-events";

function parseRp(raw: string): number {
  return Number.parseInt(raw.replace(/\D/g, ""), 10);
}

export default function ShiftPage() {
  const router = useRouter();
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
        router.replace("/menu");
      }
    })();
  }, [router, refresh]);

  async function onCash(
    kind: "in" | "out",
    amountRaw: string,
    reason: string,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const amount = parseRp(amountRaw);
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
    const countedMinor = parseRp(counted);
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
      await refresh();
      await flushSalesAndVoids();
      notifyShiftChanged();
      router.replace("/day-close");
    } catch {
      setError(t.shiftCloseFail);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !current || !expected) {
    return <AuthLoadingShell message={t.loading} />;
  }

  const difference =
    expected && Number.isInteger(parseRp(counted))
      ? parseRp(counted) - expected.expected_cash_minor
      : null;

  return (
    <AppShell
      title={t.shiftTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={t.shiftActive}
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
              {t.shiftClose}
            </Button>
          </form>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="min-h-12 w-full rounded-2xl bg-secondary text-secondary-foreground"
            onClick={() => router.push("/menu")}
          >
            {t.shiftToMenu}
          </Button>
        </div>
    </AppShell>
  );
}
