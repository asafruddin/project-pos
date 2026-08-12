"use client";

import {
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  XIcon,
} from "@phosphor-icons/react";
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
    <aside
      id="cart-panel"
      className="fixed inset-x-3 bottom-24 z-30 max-h-[55vh] overflow-y-auto rounded-3xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-sm md:static md:inset-auto md:bottom-auto md:z-auto md:h-full md:max-h-none md:shadow-sm md:backdrop-blur-none"
    >
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
        <ShoppingCartIcon size={22} weight="duotone" className="text-accent" />
        {t.cart}
      </h2>
      {receipt ? (
        <p className="mt-3 rounded-2xl border border-border bg-secondary/70 p-3 text-sm" role="status">
          {receipt}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
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
            className="min-h-14 w-full rounded-2xl bg-accent text-accent-foreground hover:opacity-90"
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
                      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border"
                      aria-label={`${t.qtyDown} ${line.name}`}
                      onClick={() => setQty(line.productId, line.qty - 1)}
                    >
                      <MinusIcon size={18} weight="bold" />
                    </button>
                    <span className="min-w-8 text-center">{line.qty}</span>
                    <button
                      type="button"
                      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border"
                      aria-label={`${t.qtyUp} ${line.name}`}
                      onClick={() => setQty(line.productId, line.qty + 1)}
                    >
                      <PlusIcon size={18} weight="bold" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl text-destructive"
                      aria-label={`${t.removeLine} ${line.name}`}
                      onClick={() => setQty(line.productId, 0)}
                    >
                      <XIcon size={18} weight="bold" />
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
            className="mt-4 min-h-14 w-full rounded-2xl bg-accent text-accent-foreground hover:opacity-90"
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
