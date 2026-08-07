"use client";

import { useState } from "react";
import {
  completeSale,
  createIncompleteSale,
  discardIncompleteSale,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-context";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";

type Props = {
  lang: LangPref;
  onCompleted: (sale: LocalSaleRecord) => Promise<void>;
};

export function CartPanel({ lang, onCompleted }: Props) {
  const t = copy(lang);
  const { lines, setQty, clear } = useCart();
  const [sale, setSale] = useState<LocalSaleRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const total = lines.reduce((sum, line) => sum + line.priceMinor * line.qty, 0);

  async function startCheckout() {
    if (!lines.length) return;
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      setSale(
        await createIncompleteSale({
          lines: lines.map(({ productId, name, priceMinor, qty }) => ({
            productId,
            name,
            priceMinor,
            qty,
          })),
        }),
      );
    } catch {
      setError(t.checkoutFail);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReceipt() {
    if (!sale) return;
    setBusy(true);
    setError(null);
    try {
      const completed = await completeSale(sale.saleId, {
        method: "cash",
        amountMinor: sale.lines.reduce(
          (sum, line) => sum + line.priceMinor * line.qty,
          0,
        ),
      });
      await onCompleted(completed);
      clear();
      setSale(null);
      setReceipt(t.receiptSuccess);
    } catch {
      setError(t.receiptFail);
    } finally {
      setBusy(false);
    }
  }

  async function cancelCheckout() {
    if (!sale) return;
    setBusy(true);
    try {
      await discardIncompleteSale(sale.saleId);
      setSale(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-10 max-h-[75vh] overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-xl md:static md:max-h-none md:rounded-xl md:shadow-none">
      <h2 className="text-xl font-semibold">{t.cart}</h2>
      {receipt ? (
        <p className="mt-3 rounded-lg bg-secondary p-3 text-sm" role="status">
          {receipt}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {sale ? (
        <div className="mt-4 space-y-3">
          <p className="font-medium">
            {t.cashPayment} {formatIdr(total, lang)}
          </p>
          <p className="text-sm text-muted-foreground">{t.receiptHint}</p>
          <Button
            className="min-h-14 w-full"
            disabled={busy}
            onClick={() => void confirmReceipt()}
          >
            {busy ? t.pending : t.confirmReceipt}
          </Button>
          <button
            type="button"
            disabled={busy}
            className="min-h-12 w-full text-sm text-muted-foreground"
            onClick={() => void cancelCheckout()}
          >
            {t.cancelCheckout}
          </button>
        </div>
      ) : lines.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.cartEmpty}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {lines.map((line) => (
              <li key={line.productId} className="border-b border-border pb-3">
                <p className="font-medium">{line.name}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {formatIdr(line.priceMinor * line.qty, lang)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-h-12 min-w-12 rounded-lg border border-border"
                      aria-label={`${t.qtyDown} ${line.name}`}
                      onClick={() => setQty(line.productId, line.qty - 1)}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center">{line.qty}</span>
                    <button
                      type="button"
                      className="min-h-12 min-w-12 rounded-lg border border-border"
                      aria-label={`${t.qtyUp} ${line.name}`}
                      onClick={() => setQty(line.productId, line.qty + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="min-h-12 min-w-12 rounded-lg text-destructive"
                      aria-label={`${t.removeLine} ${line.name}`}
                      onClick={() => setQty(line.productId, 0)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-semibold">
            <span>{t.total}</span>
            <span>{formatIdr(total, lang)}</span>
          </p>
          <Button
            className="mt-4 min-h-14 w-full"
            disabled={busy || !lines.length}
            onClick={() => void startCheckout()}
          >
            {busy ? t.pending : t.pay}
          </Button>
        </>
      )}
    </aside>
  );
}
