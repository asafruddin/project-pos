"use client";

import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import {
  ArchiveTrayIcon,
  CaretDownIcon,
  CaretUpIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  completeSale,
  createIncompleteSale,
  discardIncompleteSale,
  discardParkedCart,
  evaluateManagerDiscount,
  evaluatePromotions,
  evaluateVoucher,
  getCachedPromotions,
  getOpenShift,
  getParkedCart,
  listCatalogProducts,
  listParkedCarts,
  parkCart,
  stackSaleDiscounts,
  verifyManagerPin,
  type CatalogProductRecord,
  type LocalSaleRecord,
  type ParkedCartRecord,
} from "@pos-apps/local-db";
import type { Promotion, Voucher } from "@pos-apps/types";
import { useCart } from "@/components/providers/cart-context";
import { SaleReceiptPreview } from "@/components/organisms/sale-receipt";
import { UnpackConfirmDialog } from "@/components/organisms/unpack-confirm-dialog";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr, parseGroupedInt } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";
import { SHIFT_CHANGED_EVENT } from "@/lib/shift-events";
import { CART_TOGGLE_EVENT } from "@/lib/cart-events";
import { cn } from "@/lib/utils";
import { canOfferUnpack, performUnpack } from "@/lib/unpack";

type Props = {
  lang: LangPref;
  onCompleted: (sale: LocalSaleRecord) => Promise<void>;
};

function parkedLabel(parked: ParkedCartRecord): string {
  const first = parked.lines[0]?.name ?? "";
  const extra = parked.lines.length - 1;
  return extra > 0 ? `${first} +${extra}` : first;
}

function parkedQty(parked: ParkedCartRecord): number {
  return parked.lines.reduce((sum, line) => sum + line.qty, 0);
}

export function CartPanel({ lang, onCompleted }: Props) {
  const t = copy(lang);
  const { lines, setQty, clear, replaceLines, guestName, setGuestName, add, raiseStockCap } =
    useCart();
  const [sale, setSale] = useState<LocalSaleRecord | null>(null);
  const [parked, setParked] = useState<ParkedCartRecord[]>([]);
  const [parkedDialogOpen, setParkedDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [previewSale, setPreviewSale] = useState<LocalSaleRecord | null>(null);
  const [previewCustomerName, setPreviewCustomerName] = useState<string | null>(
    null,
  );
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [managerMinor, setManagerMinor] = useState(0);
  const [managerPin, setManagerPin] = useState("");
  const [catalogById, setCatalogById] = useState<Map<string, CatalogProductRecord>>(
    new Map(),
  );
  const [unpackTarget, setUnpackTarget] = useState<CatalogProductRecord | null>(
    null,
  );
  const [unpackBusy, setUnpackBusy] = useState(false);
  const [unpackError, setUnpackError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "qris">("cash");
  const lineTotal = lines.reduce((sum, line) => sum + line.priceMinor * line.qty, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const parkedBadge = parked.length > 99 ? "99+" : String(parked.length);

  useEffect(() => {
    if (sale) setMobileOpen(true);
  }, [sale]);

  useEffect(() => {
    function onToggle() {
      setMobileOpen((open) => !open);
    }
    window.addEventListener(CART_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(CART_TOGGLE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    void listCatalogProducts().then((rows) => {
      setCatalogById(new Map(rows.map((row) => [row.productId, row])));
    });
  }, [lines]);

  useEffect(() => {
    void getCachedPromotions().then(setPromos);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const promoEval = evaluatePromotions({
    promotions: promos,
    lines: lines.map((line) => ({
      product_id: line.productId,
      qty: line.qty,
      price_minor: line.priceMinor,
    })),
    coupon_code: couponCode,
    customer_group: null,
    local_hour: new Date().getHours(),
  });
  const afterPromo = lineTotal - promoEval.discount_minor;
  const managerEval = evaluateManagerDiscount({
    discount_minor: managerMinor,
    payable_minor: afterPromo,
  });
  const afterManager = afterPromo - managerEval.discount_minor;
  const voucherEval =
    online && voucher
      ? evaluateVoucher({
          remaining_minor: voucher.remaining_minor,
          payable_minor: afterManager,
        })
      : { ok: true as const, applied_minor: 0, remaining_minor: 0, skipped: true };
  const payable = stackSaleDiscounts({
    line_total_minor: lineTotal,
    promo_discount_minor: promoEval.discount_minor,
    manager_discount_minor: managerEval.discount_minor,
    voucher_minor: voucherEval.applied_minor,
    loyalty_discount_minor: 0,
  });

  function beginWork(): boolean {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    return true;
  }

  function endWork() {
    inFlight.current = false;
    setBusy(false);
  }

  async function refreshParked() {
    setParked(await listParkedCarts());
  }

  useEffect(() => {
    void refreshParked();
    function syncShift() {
      void getOpenShift().then((row) => setShiftOpen(Boolean(row)));
    }
    syncShift();
    window.addEventListener(SHIFT_CHANGED_EVENT, syncShift);
    return () => window.removeEventListener(SHIFT_CHANGED_EVENT, syncShift);
  }, []);

  useEffect(() => {
    if (!parked.length) setParkedDialogOpen(false);
  }, [parked.length]);

  async function startCheckout() {
    if (!lines.length || !beginWork()) return;
    setError(null);
    setReceipt(null);
    const open = await getOpenShift();
    if (!open) {
      setShiftOpen(false);
      setError(t.shiftNeedOpen);
      endWork();
      return;
    }
    setShiftOpen(true);
      setPayMethod("cash");
      try {
        setPromos(await getCachedPromotions());
      setSale(
        await createIncompleteSale({
          lines: lines.map(({ productId, name, priceMinor, qty }) => ({
            productId,
            name,
            priceMinor,
            qty,
          })),
          guestName,
        }),
      );
    } catch {
      setError(t.checkoutFail);
    } finally {
      endWork();
    }
  }

  async function confirmReceipt() {
    if (!sale || !beginWork()) return;
    setError(null);
    try {
      const lineTotalSale = sale.lines.reduce(
        (sum, line) => sum + line.priceMinor * line.qty,
        0,
      );
      const livePromos = await getCachedPromotions();
      const livePromo = evaluatePromotions({
        promotions: livePromos,
        lines: sale.lines.map((line) => ({
          product_id: line.productId,
          qty: line.qty,
          price_minor: line.priceMinor,
        })),
        coupon_code: couponCode,
        customer_group: null,
        local_hour: new Date().getHours(),
      });
      const afterPromoSale = lineTotalSale - livePromo.discount_minor;
      if (managerEval.discount_minor > 0) {
        if (!/^\d{6}$/.test(managerPin) || !(await verifyManagerPin(managerPin))) {
          setError(t.managerPinNeed);
          return;
        }
      }
      const liveManager = evaluateManagerDiscount({
        discount_minor: managerMinor,
        payable_minor: afterPromoSale,
      });
      const afterManagerSale = afterPromoSale - liveManager.discount_minor;
      let liveVoucher = {
        ok: true as const,
        applied_minor: 0,
        remaining_minor: 0,
        skipped: true,
      };
      if (navigator.onLine && voucherCode.trim()) {
        try {
          const res = await authorizedFetch(
            `/vouchers/code/${encodeURIComponent(voucherCode.trim())}`,
          );
          if (res.ok) {
            const row = (await res.json()) as Voucher;
            liveVoucher = evaluateVoucher({
              remaining_minor: row.remaining_minor,
              payable_minor: afterManagerSale,
            });
          } else {
            setError(t.voucherInvalid);
            return;
          }
        } catch {
          setError(t.voucherInvalid);
          return;
        }
      }
      const payableSale = stackSaleDiscounts({
        line_total_minor: lineTotalSale,
        promo_discount_minor: livePromo.discount_minor,
        manager_discount_minor: liveManager.discount_minor,
        voucher_minor: liveVoucher.applied_minor,
        loyalty_discount_minor: 0,
      });
      const remainderMethod = payMethod;
      const completed = await completeSale(
        sale.saleId,
        {
          tenders: [{ method: remainderMethod, amountMinor: payableSale }],
        },
        null,
        livePromo.discount_minor > 0 ||
          liveVoucher.applied_minor > 0 ||
          liveManager.discount_minor > 0 ||
          couponCode.trim()
          ? {
              discountMinor: livePromo.discount_minor,
              couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : null,
              voucherCode: liveVoucher.applied_minor > 0
                ? voucherCode.trim().toUpperCase()
                : null,
              voucherMinor: liveVoucher.applied_minor,
              managerDiscountMinor: liveManager.discount_minor,
              applied: livePromo.applied.map((row) => ({
                promotionId: row.promotion_id,
                name: row.name,
                discountMinor: row.discount_minor,
              })),
            }
          : null,
      );
      await onCompleted(completed);
      const printedName = guestName?.trim() || null;
      clear();
      setSale(null);
      setPayMethod("cash");
      setReceipt(t.receiptSuccess);
      setPreviewCustomerName(printedName);
      setPreviewSale(completed);
    } catch (err) {
      if (err instanceof Error && err.message === "SHIFT_REQUIRED") {
        setShiftOpen(false);
        setError(t.shiftNeedOpen);
      } else if (
        err instanceof Error &&
        err.message === "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER"
      ) {
        setError(t.tenderFailCustomer);
      } else if (
        err instanceof Error &&
        err.message === "TENDER_STORE_CREDIT_EXCEEDS_BALANCE"
      ) {
        setError(t.tenderFailBalance);
      } else if (
        err instanceof Error &&
        (err.message === "TENDER_SUM_MISMATCH" ||
          err.message === "TENDER_CASH_QRIS_MIX")
      ) {
        setError(t.tenderFailSum);
      } else if (
        err instanceof Error &&
        (err.message === "LOYALTY_INVALID" ||
          err.message === "LOYALTY_INSUFFICIENT")
      ) {
        setError(t.loyaltyInsufficient);
      } else {
        setError(t.receiptFail);
      }
    } finally {
      endWork();
    }
  }

  async function cancelCheckout() {
    if (!sale || !beginWork()) return;
    try {
      await discardIncompleteSale(sale.saleId);
      setSale(null);
      setPayMethod("cash");
    } finally {
      endWork();
    }
  }

  async function holdCart() {
    if (sale || !lines.length || !beginWork()) return;
    setError(null);
    setReceipt(null);
    try {
      await parkCart(
        lines.map(({ productId, name, priceMinor, qty }) => ({
          productId,
          name,
          priceMinor,
          qty,
        })),
        {
          customerName: guestName?.trim() || null,
        },
      );
      clear();
    } catch {
      setError(t.parkFail);
    } finally {
      await refreshParked();
      endWork();
    }
  }

  async function resumeHold(parkId: string) {
    if (sale) return;
    if (lines.length) {
      setError(t.resumeFailBusy);
      return;
    }
    if (!beginWork()) return;
    setError(null);
    setReceipt(null);
    try {
      const catalog = await listCatalogProducts();
      const record = await getParkedCart(parkId);
      const byId = new Map(catalog.map((product) => [product.productId, product]));
      replaceLines(
        record.lines.map((line) => {
          const catalogPriceMinor =
            byId.get(line.productId)?.priceMinor ?? line.priceMinor;
          return {
            ...line,
            catalogPriceMinor,
            stockQty: Math.max(
              line.qty,
              byId.get(line.productId)?.stockQty ?? line.qty,
            ),
            trackStock:
              byId.get(line.productId)?.trackStock === false ? false : true,
          };
        }),
      );
      setGuestName(record.customerName ?? null);
      await discardParkedCart(parkId);
      setParkedDialogOpen(false);
    } catch {
      setError(t.resumeFail);
    } finally {
      await refreshParked();
      endWork();
    }
  }

  async function discardHold(parkId: string) {
    if (sale || !beginWork()) return;
    setError(null);
    try {
      await discardParkedCart(parkId);
      await refreshParked();
    } finally {
      endWork();
    }
  }

  function parkedButton() {
    if (!parked.length) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative size-9 rounded-xl md:size-10"
        onClick={() => setParkedDialogOpen(true)}
        aria-label={`${t.parked}: ${parkedBadge}`}
        title={`${t.parked}: ${parkedBadge}`}
      >
        <ArchiveTrayIcon size={19} weight="duotone" />
        <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-primary-foreground">
          {parkedBadge}
        </span>
      </Button>
    );
  }

  const receiptNameField = !sale ? (
    <div className="mb-3">
      <Label htmlFor="cart-receipt-name">{t.receiptName}</Label>
      <div className="relative mt-1.5">
        <Input
          id="cart-receipt-name"
          value={guestName ?? ""}
          disabled={busy}
          placeholder={t.receiptNamePh}
          maxLength={80}
          autoComplete="name"
          className="h-11 rounded-xl pr-11"
          onChange={(e) => setGuestName(e.target.value)}
        />
        {guestName ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-9 -translate-y-1/2 rounded-lg text-muted-foreground"
            disabled={busy}
            aria-label={t.receiptNameClear}
            onClick={() => setGuestName(null)}
          >
            <XIcon size={16} weight="bold" />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t.receiptNameHint}</p>
    </div>
  ) : null;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 top-0 z-20 h-[calc(100dvh-4.75rem-env(safe-area-inset-bottom))] bg-black/40 md:hidden"
          aria-label={t.cartCollapse}
          onClick={() => {
            if (!sale) setMobileOpen(false);
          }}
        />
      ) : null}
    <aside
      id="cart-panel"
      className={cn(
        "fixed inset-x-3 z-30 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] md:static md:inset-auto md:bottom-auto md:z-auto md:h-full md:max-h-none md:min-h-0",
        mobileOpen
          ? "top-12 bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-h-none",
      )}
    >
      <SaleReceiptPreview
        sale={previewSale}
        customerName={previewCustomerName}
        lang={lang}
        open={Boolean(previewSale)}
        onClose={() => {
          setPreviewSale(null);
          setPreviewCustomerName(null);
        }}
      />
      <UnpackConfirmDialog
        lang={lang}
        product={unpackTarget}
        open={Boolean(unpackTarget)}
        busy={unpackBusy}
        error={unpackError}
        onCancel={() => {
          if (unpackBusy) return;
          setUnpackTarget(null);
          setUnpackError(null);
        }}
        onConfirm={() => {
          if (!unpackTarget || unpackBusy) return;
          void (async () => {
            setUnpackBusy(true);
            setUnpackError(null);
            const result = await performUnpack(unpackTarget);
            if (!result.ok) {
              setUnpackError(
                result.message === "network" ? t.unpackFail : result.message,
              );
              setUnpackBusy(false);
              const rows = await listCatalogProducts();
              setCatalogById(new Map(rows.map((row) => [row.productId, row])));
              return;
            }
            raiseStockCap(result.product.productId, result.product.stockQty);
            add(result.product);
            setUnpackBusy(false);
            setUnpackTarget(null);
            const rows = await listCatalogProducts();
            setCatalogById(new Map(rows.map((row) => [row.productId, row])));
          })();
        }}
      />
      <Dialog open={parkedDialogOpen} onOpenChange={setParkedDialogOpen}>
        <DialogContent className="max-h-[min(80dvh,38rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.parked}</DialogTitle>
            <DialogDescription>{t.parkedDialogHint}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {parked.map((row) => (
              <li
                key={row.parkId}
                className="rounded-2xl border border-border bg-secondary/40 px-3 py-2"
              >
                <p className="font-medium">{parkedLabel(row)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatIdr(row.totalMinor, lang)} ·{" "}
                  {t.holdLineCount.replace("{count}", String(parkedQty(row)))}
                  {row.customerName ? ` · ${row.customerName}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="h-12 min-h-12 flex-1 rounded-2xl"
                    onClick={() => void resumeHold(row.parkId)}
                  >
                    <PlayIcon size={16} weight="bold" />
                    {t.resumeHold}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    className="h-12 w-12 rounded-2xl text-destructive hover:text-destructive"
                    aria-label={`${t.discardHold} ${parkedLabel(row)}`}
                    onClick={() => void discardHold(row.parkId)}
                  >
                    <TrashSimpleIcon size={18} weight="bold" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <button
        type="button"
        className="flex w-full shrink-0 items-center gap-2.5 px-3 py-2.5 text-left md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="cart-panel-body"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="relative inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShoppingCartIcon size={20} weight="duotone" />
          {itemCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{t.cart}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {itemCount > 0
              ? t.cartItemCount.replace("{count}", String(itemCount))
              : t.cartEmpty}
          </span>
        </span>
        {itemCount > 0 ? (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatIdr(payable, lang)}
          </span>
        ) : null}
        {mobileOpen ? (
          <CaretDownIcon size={18} weight="bold" className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretUpIcon size={18} weight="bold" className="shrink-0 text-muted-foreground" />
        )}
      </button>
      <h2 className="hidden shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 text-lg font-semibold tracking-tight text-foreground md:flex sm:px-5">
        <span className="flex items-center gap-2">
          <ShoppingCartIcon size={22} weight="duotone" className="text-primary" />
          {t.cart}
        </span>
        {parkedButton()}
      </h2>
      <div
        id="cart-panel-body"
        className={cn(
          "min-h-0 flex-1 flex-col",
          mobileOpen ? "flex border-t border-border md:border-t-0" : "hidden md:flex",
        )}
      >
      {mobileOpen && parked.length > 0 ? (
        <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2 md:hidden">
          {parkedButton()}
        </div>
      ) : null}
      {receipt ? (
        <p className="shrink-0 border-b border-border px-4 py-3 text-sm sm:px-5" role="status">
          {receipt}
        </p>
      ) : null}
      {error ? (
        <p
          className="mx-4 mt-3 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-5"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {sale ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <p className="font-medium">
            {payMethod === "qris" ? t.qrisPayment : t.cashPayment}{" "}
            {formatIdr(payable, lang)}
          </p>
          {payable > 0 ? (
            <div
              className="inline-flex rounded-xl border border-border bg-background p-1"
              role="group"
              aria-label={t.qrisPayment}
            >
              <Button
                type="button"
                variant={payMethod === "cash" ? "default" : "ghost"}
                className="h-9 rounded-lg px-3 text-sm"
                aria-pressed={payMethod === "cash"}
                disabled={busy}
                onClick={() => setPayMethod("cash")}
              >
                {t.cashTender}
              </Button>
              <Button
                type="button"
                variant={payMethod === "qris" ? "default" : "ghost"}
                className="h-9 rounded-lg px-3 text-sm"
                aria-pressed={payMethod === "qris"}
                disabled={busy}
                onClick={() => setPayMethod("qris")}
              >
                {t.qris}
              </Button>
            </div>
          ) : null}
          <div className="space-y-2 text-sm">
            {promoEval.discount_minor > 0 ? (
              <p className="flex justify-between">
                <span>{t.promoDiscount}</span>
                <span>-{formatIdr(promoEval.discount_minor, lang)}</span>
              </p>
            ) : null}
            <Label className="flex items-center justify-between gap-2 font-normal">
              <span>{t.coupon}</span>
              <Input
                value={couponCode}
                disabled={busy}
                className="h-8 w-32 uppercase"
                onChange={(e) => setCouponCode(e.target.value)}
              />
            </Label>
            {promoEval.coupon_error ? (
              <p className="text-destructive">{t.couponInvalid}</p>
            ) : null}
            {online ? (
              <Label className="flex items-center justify-between gap-2 font-normal">
                <span>{t.voucher}</span>
                <Input
                  value={voucherCode}
                  disabled={busy}
                  className="h-8 w-32 uppercase"
                  onChange={(e) => {
                    setVoucherCode(e.target.value);
                    setVoucher(null);
                  }}
                  onBlur={() => {
                    const code = voucherCode.trim();
                    if (!code || !navigator.onLine) return;
                    void authorizedFetch(`/vouchers/code/${encodeURIComponent(code)}`)
                      .then(async (res) => {
                        if (!res.ok) {
                          setVoucher(null);
                          return;
                        }
                        setVoucher((await res.json()) as Voucher);
                      })
                      .catch(() => setVoucher(null));
                  }}
                />
              </Label>
            ) : (
              <p className="text-muted-foreground">{t.voucherOffline}</p>
            )}
            {voucherEval.applied_minor > 0 ? (
              <p className="flex justify-between">
                <span>{t.voucher}</span>
                <span>-{formatIdr(voucherEval.applied_minor, lang)}</span>
              </p>
            ) : null}
            <Label className="flex items-center justify-between gap-2 font-normal">
              <span>{t.managerDiscount}</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={managerEval.discount_minor}
                disabled={busy}
                className="h-8 w-32 text-right"
                onChange={(e) => {
                  const next = parseGroupedInt(e.target.value);
                  setManagerMinor(Number.isInteger(next) ? Math.max(0, next) : 0);
                }}
              />
            </Label>
            {managerEval.discount_minor > 0 ? (
              <Label className="flex items-center justify-between gap-2 font-normal">
                <span>{t.managerPin}</span>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={managerPin}
                  disabled={busy}
                  className="h-8 w-32 tracking-[0.3em]"
                  onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </Label>
            ) : null}
          </div>
          </div>
          <div className="shrink-0 border-t border-border px-4 py-4 sm:px-5">
            <p className="text-sm text-muted-foreground">{t.receiptHint}</p>
            <Button
              className="mt-4 h-12 min-h-12 w-full rounded-xl"
              disabled={busy}
              onClick={() => void confirmReceipt()}
            >
              {busy ? t.pending : t.confirmReceipt}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-auto min-h-12 w-full text-sm text-muted-foreground"
              disabled={busy}
              onClick={() => void cancelCheckout()}
            >
              {t.cancelCheckout}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {receiptNameField ? (
            <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
              {receiptNameField}
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-1 sm:px-5">
          {lines.length === 0 ? (
            <div className="flex min-h-24 flex-1 flex-col items-center justify-center gap-2 py-6 text-center md:min-h-40 md:py-8">
              <ShoppingCartIcon
                size={40}
                weight="duotone"
                className="text-muted-foreground/50"
              />
              <p className="text-sm text-muted-foreground">{t.cartEmpty}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.productId} className="border-b border-border pb-3">
                  <p className="font-medium">{line.name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {formatIdr(line.priceMinor * line.qty, lang)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl"
                        aria-label={`${t.qtyDown} ${line.name}`}
                        onClick={() => setQty(line.productId, line.qty - 1)}
                      >
                        <MinusIcon size={18} weight="bold" />
                      </Button>
                      <span className="min-w-8 text-center">{line.qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-2xl"
                        aria-label={`${t.qtyUp} ${line.name}`}
                        onClick={() => {
                          const catalog = catalogById.get(line.productId);
                          if (
                            line.trackStock === false ||
                            catalog?.trackStock === false ||
                            line.qty < line.stockQty
                          ) {
                            setQty(line.productId, line.qty + 1);
                            return;
                          }
                          if (
                            catalog &&
                            canOfferUnpack(
                              catalog,
                              online,
                              [...catalogById.values()],
                            )
                          ) {
                            setUnpackError(null);
                            setUnpackTarget({
                              ...catalog,
                              stockQty: line.stockQty,
                            });
                            return;
                          }
                          setQty(line.productId, line.qty + 1);
                        }}
                      >
                        <PlusIcon size={18} weight="bold" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-2xl text-destructive hover:text-destructive"
                        aria-label={`${t.removeLine} ${line.name}`}
                        onClick={() => setQty(line.productId, 0)}
                      >
                        <XIcon size={18} weight="bold" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
          {lines.length > 0 ? (
            <div className="shrink-0 border-t border-border px-4 py-4 sm:px-5">
              <p className="flex justify-between font-semibold">
                <span>{t.total}</span>
                <span>{formatIdr(payable, lang)}</span>
              </p>
              {!shiftOpen ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.shiftNeedOpen}
                </p>
              ) : null}
              <Button
                className="mt-4 h-12 min-h-12 w-full rounded-xl"
                disabled={busy || !shiftOpen}
                onClick={() => void startCheckout()}
              >
                {busy ? t.pending : t.pay}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="mt-2 h-12 min-h-12 w-full rounded-xl text-sm"
                onClick={() => void holdCart()}
              >
                <PauseIcon size={16} weight="bold" />
                {t.hold}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      </div>
    </aside>
    </>
  );
}
