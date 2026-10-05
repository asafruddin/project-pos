import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useContainer, useEventValue } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { cartFromParked, type Cart } from "@/features/cart/domain/cart";
import type { ParkedCart } from "@/features/cart/domain/parked-cart";
import { useOnline } from "@/hooks/useOnline";
import { useT, type Translate } from "@/i18n";
import { formatIdr, parseGroupedInt } from "@/utils/money";
import { cashChange, priceCart, type PricingBreakdown } from "../domain/pricing";
import type { CompletedSale } from "../domain/sale";

export type VoucherState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; remainingMinor: number }
  | { status: "invalid" }
  | { status: "offline" };

/** Maps use-case error codes to the PWA's user-facing messages. */
export function saleErrorMessage(error: unknown, t: Translate, shortMinor = 0, lang: "id" | "en" = "id"): string {
  const code = isAppError(error) ? error.message : "";
  switch (code) {
    case "NO_OPEN_SHIFT":
      return t("shiftNeedOpen");
    case "MANAGER_PIN_REQUIRED":
    case "MANAGER_PIN_LOCKED":
      return t("managerPinNeed");
    case "VOUCHER_INVALID":
      return t("voucherInvalid");
    case "CASH_SHORT":
      return t("cashShort", { amount: formatIdr(shortMinor, lang) });
    case "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER":
      return t("tenderFailCustomer");
    case "TENDER_STORE_CREDIT_EXCEEDS_BALANCE":
      return t("tenderFailBalance");
    case "TENDER_SUM_MISMATCH":
    case "TENDER_CASH_QRIS_MIX":
      return t("tenderFailSum");
    default:
      return t("receiptFail");
  }
}

/**
 * Orchestrates the cart panel: live pricing, voucher lookup, pay step, confirm, hold/resume.
 * All state that must survive a layout change (phone ⇄ tablet) lives in the cart store.
 */
export function useCheckout() {
  const container = useContainer();
  const { t, lang } = useT();
  const online = useOnline();
  const cart = useStore(container.cart);
  const hasShift = useEventValue(["shift"], (c) => c.repositories.shifts.getOpen() !== null);
  const parked = useEventValue(["parked"], (c) => c.repositories.parked.list());
  const promotions = useEventValue(["promos"], (c) => c.repositories.promotions.get());

  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ sale: CompletedSale; name: string | null } | null>(null);
  const [lookup, setLookup] = useState<{ code: string; ok: boolean; remainingMinor: number } | null>(null);

  // Voucher lookup (online only), debounced while the cashier types. State is only set from the async result.
  const voucherCode = cart.voucherCode.trim();
  useEffect(() => {
    if (!voucherCode || !online) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      container.remotes.vouchers.lookup(voucherCode).then(
        (v) => !cancelled && setLookup({ code: voucherCode, ok: v.enabled !== false, remainingMinor: v.remaining_minor }),
        () => !cancelled && setLookup({ code: voucherCode, ok: false, remainingMinor: 0 }),
      );
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [voucherCode, online, container]);

  const voucher: VoucherState = useMemo(() => {
    if (!voucherCode) return { status: "idle" };
    if (!online) return { status: "offline" };
    if (lookup?.code !== voucherCode) return { status: "checking" };
    return lookup.ok ? { status: "ok", remainingMinor: lookup.remainingMinor } : { status: "invalid" };
  }, [voucherCode, online, lookup]);

  const managerMinor = useMemo(() => {
    const n = parseGroupedInt(cart.managerDiscount);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }, [cart.managerDiscount]);

  const pricing: PricingBreakdown = useMemo(
    () =>
      priceCart({
        lines: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, priceMinor: l.priceMinor })),
        promotions,
        couponCode: cart.couponCode,
        managerDiscountMinor: managerMinor,
        voucherRemainingMinor: voucher.status === "ok" ? voucher.remainingMinor : null,
        localHour: new Date().getHours(),
      }),
    [cart.lines, cart.couponCode, promotions, managerMinor, voucher],
  );

  const received = parseGroupedInt(cart.cashReceived);
  const cash = cashChange(pricing.payableMinor, Number.isNaN(received) ? null : received);
  const cashShort = cart.payMethod === "cash" && pricing.payableMinor > 0 && cash.short;

  const begin = useCallback(() => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    return true;
  }, []);
  const end = useCallback(() => {
    inFlight.current = false;
    setBusy(false);
  }, []);

  const startPay = useCallback(() => {
    if (cart.lines.length === 0) return;
    setError(null);
    if (!container.repositories.shifts.getOpen()) {
      setError(t("shiftNeedOpen"));
      return;
    }
    container.cart.getState().set({ paying: true, payMethod: "cash", cashReceived: "" });
  }, [cart.lines.length, container, t]);

  const confirm = useCallback(async () => {
    if (!cart.paying || !begin()) return;
    setError(null);
    try {
      const state = container.cart.getState();
      const sale = await container.useCases.completeSale.execute({
        cart: { lines: state.lines } satisfies Cart,
        method: state.payMethod,
        cashReceivedMinor: Number.isNaN(parseGroupedInt(state.cashReceived)) ? null : parseGroupedInt(state.cashReceived),
        guestName: state.guestName,
        couponCode: state.couponCode,
        voucherCode: state.voucherCode,
        managerDiscountMinor: managerMinor,
        managerPin: state.managerPin,
      });
      container.useCases.printReceipt.execute(sale, sale.guestName);
      const name = sale.guestName;
      state.clear();
      setCompleted({ sale, name });
      container.catalogEvents.setState((s) => ({ ...s, pulledAt: container.repositories.catalog.getPulledAt() }));
    } catch (e) {
      setError(saleErrorMessage(e, t, cash.shortMinor, lang));
    } finally {
      end();
    }
  }, [begin, cart.paying, cash.shortMinor, container, end, lang, managerMinor, t]);

  const hold = useCallback(() => {
    if (cart.paying || cart.lines.length === 0 || !begin()) return;
    setError(null);
    try {
      container.saveCartAsParked();
    } catch {
      setError(t("parkFail"));
    } finally {
      end();
    }
  }, [begin, cart.lines.length, cart.paying, container, end, t]);

  const resume = useCallback(
    (parkId: string): boolean => {
      if (cart.paying) return false;
      if (cart.lines.length > 0) {
        setError(t("resumeFailBusy"));
        return false;
      }
      if (!begin()) return false;
      setError(null);
      try {
        const record = container.repositories.parked.get(parkId);
        if (!record) throw new Error("PARK_NOT_FOUND");
        const byId = new Map(container.repositories.catalog.listSellable().map((p) => [p.productId, p]));
        container.cart.getState().replaceLines(cartFromParked(record.lines, byId).lines, record.customerName ?? "");
        container.repositories.parked.delete(parkId);
        container.notifyParkedChanged();
        return true;
      } catch {
        setError(t("resumeFail"));
        return false;
      } finally {
        end();
      }
    },
    [begin, cart.lines.length, cart.paying, container, end, t],
  );

  const discard = useCallback(
    (parkId: string) => {
      if (cart.paying || !begin()) return;
      try {
        container.repositories.parked.delete(parkId);
        container.notifyParkedChanged();
      } finally {
        end();
      }
    },
    [begin, cart.paying, container, end],
  );

  return {
    cart,
    hasShift,
    parked: parked as ParkedCart[],
    pricing,
    voucher,
    cash,
    cashShort,
    busy,
    error,
    setError,
    completed,
    clearCompleted: () => setCompleted(null),
    online,
    startPay,
    confirm,
    hold,
    resume,
    discard,
    cancelPay: () => {
      container.cart.getState().cancelPay();
      setError(null);
    },
  };
}
