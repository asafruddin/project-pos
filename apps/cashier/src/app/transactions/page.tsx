"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@pos-apps/ui/molecules/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, SaleLookupResponse } from "@pos-apps/types";
import {
  enrollManagerPin,
  hasManagerPin,
  listCachedCustomers,
  listCompleteSalesForLocalDay,
  verifyManagerPin,
  verifyPin,
  voidCompleteSale,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
import { PinPad } from "@/components/organisms/pin-pad";
import { ReturnSaleForm } from "@/components/organisms/return-sale-form";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, getSession, isAccessTokenExpired } from "@/lib/auth-token";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang, type LangPref } from "@/lib/preferences";

export default function TransactionsPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [sales, setSales] = useState<LocalSaleRecord[] | null>(null);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<LocalSaleRecord | null>(null);
  const [pinMode, setPinMode] = useState<"enroll" | "unlock" | null>(null);
  const [pin, setPin] = useState("");
  const [returnSale, setReturnSale] = useState<SaleLookupResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    const data = await fetchTodaySales();
    setSales(data.rows);
    setCustomerNames(data.names);
  }, []);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    let cancelled = false;
    void fetchTodaySales().then((data) => {
      if (cancelled) return;
      setSales(data.rows);
      setCustomerNames(data.names);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  async function startReturn(sale: LocalSaleRecord) {
    if (sale.voidedAt) return;
    setError(null);
    setStatus(null);
    if (!navigator.onLine) {
      setError(t.returnOffline);
      return;
    }
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      setError(t.catalogNeedLogin);
      return;
    }
    setBusy(true);
    try {
      const res = await authorizedFetch(`/sales/${sale.saleId}`);
      const data = (await res.json()) as SaleLookupResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? t.returnFail);
        return;
      }
      setReturnSale(data as SaleLookupResponse);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError(t.returnFail);
    } finally {
      setBusy(false);
    }
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

  function onPinChange(next: string) {
    setPin(next);
    if (next.length === 6 && pinMode) void submitManagerPin(next);
  }

  if (sales === null) {
    return <AuthLoadingShell message={t.loading} />;
  }

  return (
    <AppShell
      title={returnSale ? t.returnTitle : t.txTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={returnSale ? t.returnHint : t.txHint}
    >
      {status ? (
        <p className="mb-4 rounded-2xl border border-border bg-secondary/70 p-3 text-sm" role="status">
          {status}
        </p>
      ) : null}
      {error && !pinMode && !returnSale ? (
        <p
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {returnSale ? (
        <ReturnSaleForm
          lang={lang}
          sale={returnSale}
          onCancel={() => {
            setReturnSale(null);
            setError(null);
          }}
          onSuccess={() => {
            setReturnSale(null);
            setStatus(`${t.returnOk} ${t.returnWaitingRefund}`.trim());
          }}
        />
      ) : sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.voidEmpty}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">{t.txColTime}</TableHead>
                <TableHead className="px-3">{t.txColRef}</TableHead>
                <TableHead className="px-3">{t.txColItems}</TableHead>
                <TableHead className="px-3">{t.txColCustomer}</TableHead>
                <TableHead className="px-3">{t.txColPay}</TableHead>
                <TableHead className="px-3 text-right">{t.total}</TableHead>
                <TableHead className="px-3">{t.txColStatus}</TableHead>
                <TableHead className="px-3 text-right">{t.txColActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => {
                const amount = sale.payment?.amountMinor ?? 0;
                const voided = Boolean(sale.voidedAt);
                const items = sale.lines
                  .map((line) => `${line.name} ×${line.qty}`)
                  .join(", ");
                const qty = sale.lines.reduce((sum, line) => sum + line.qty, 0);
                const discount = discountMinor(sale);
                return (
                  <TableRow key={sale.saleId}>
                    <TableCell className="px-3 py-3 text-muted-foreground">
                      {sale.completedAt
                        ? new Date(sale.completedAt).toLocaleTimeString(
                            lang === "en" ? "en-US" : "id-ID",
                            {day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" },
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        title={sale.saleId}
                      >
                        {sale.saleId.slice(0, 8).toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 px-3 py-3 whitespace-normal">
                      <p className="truncate font-medium" title={items}>
                        {items || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.holdLineCount.replace("{count}", String(qty))}
                      </p>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      {sale.customerId
                        ? (customerNames[sale.customerId] ?? t.customerTitle)
                        : t.txWalkIn}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <span title={payDetail(sale, lang, t)}>
                        {payLabel(sale, t)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right">
                      <p className="font-medium">{formatIdr(amount, lang)}</p>
                      {discount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          −{formatIdr(discount, lang)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      {voided ? (
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs">
                          {t.voided}
                        </span>
                      ) : (
                        <span className="rounded-md bg-primary/15 px-2 py-1 text-xs text-primary">
                          {t.dayCloseStatusDone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-right whitespace-normal">
                      {voided ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            className="min-h-11 rounded-xl"
                            onClick={() => void startReturn(sale)}
                          >
                            {t.returnTitle}
                          </Button>
                          <Button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-xl bg-secondary text-secondary-foreground hover:opacity-90"
                            onClick={() => void startVoid(sale)}
                          >
                            {t.voidAction}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-3 py-3 text-muted-foreground">
                  {t.dayCloseTxCount}: {sales.length}
                </TableCell>
                <TableCell className="px-3 py-3 text-right font-medium">
                  {formatIdr(
                    sales
                      .filter((sale) => !sale.voidedAt)
                      .reduce((sum, sale) => sum + (sale.payment?.amountMinor ?? 0), 0),
                    lang,
                  )}
                </TableCell>
                <TableCell colSpan={2} className="px-3 py-3 text-muted-foreground">
                  {t.txDayTotal}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {pinMode && target ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.voidNeedPin}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
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
                onChange={onPinChange}
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

async function fetchTodaySales() {
  const [rows, customers] = await Promise.all([
    listCompleteSalesForLocalDay(),
    listCachedCustomers(),
  ]);
  return {
    rows,
    names: Object.fromEntries(customers.map((row) => [row.customerId, row.name])),
  };
}

function discountMinor(sale: LocalSaleRecord): number {
  return (
    (sale.loyalty?.discountMinor ?? 0) +
    (sale.promotions?.discountMinor ?? 0) +
    (sale.promotions?.voucherMinor ?? 0) +
    (sale.promotions?.managerDiscountMinor ?? 0)
  );
}

function payLabel(sale: LocalSaleRecord, t: ReturnType<typeof copy>): string {
  const method = sale.payment?.method;
  if (method === "store_credit") return t.storeCredit;
  if (method === "split") return t.txPaySplit;
  return t.cashTender;
}

function payDetail(
  sale: LocalSaleRecord,
  lang: LangPref,
  t: ReturnType<typeof copy>,
): string {
  const tenders = sale.payment?.tenders;
  if (!tenders?.length) return payLabel(sale, t);
  return tenders
    .map((row) => {
      const label = row.method === "store_credit" ? t.storeCredit : t.cashTender;
      return `${label} ${formatIdr(row.amountMinor, lang)}`;
    })
    .join(" · ");
}

