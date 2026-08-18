"use client";

import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
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
  evaluateLoyaltyRedeem,
  evaluateManagerDiscount,
  evaluatePromotions,
  evaluateVoucher,
  getCachedPromotions,
  getLoyaltyProgram,
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
import type { LoyaltyProgram, Promotion, Voucher } from "@pos-apps/types";
import { useCart } from "@/components/providers/cart-context";
import { CustomerAttach, restoreCartCustomer } from "@/components/organisms/customer-attach";
import { UnpackConfirmDialog } from "@/components/organisms/unpack-confirm-dialog";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr, parseGroupedInt } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";
import { SHIFT_CHANGED_EVENT } from "@/lib/shift-events";
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
  const { lines, setQty, clear, replaceLines, customer, setCustomer, add, raiseStockCap } =
    useCart();
  const [sale, setSale] = useState<LocalSaleRecord | null>(null);
  const [parked, setParked] = useState<ParkedCartRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [creditMinor, setCreditMinor] = useState(0);
  const [redeemInput, setRedeemInput] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
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
  const lineTotal = lines.reduce((sum, line) => sum + line.priceMinor * line.qty, 0);

  useEffect(() => {
    void listCatalogProducts().then((rows) => {
      setCatalogById(new Map(rows.map((row) => [row.productId, row])));
    });
  }, [lines]);

  useEffect(() => {
    setCreditMinor(0);
    setRedeemInput(0);
  }, [customer?.customerId]);

  useEffect(() => {
    void getLoyaltyProgram().then(setProgram);
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
    customer_group: customer?.groupName ?? null,
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
  const afterVoucher = afterManager - voucherEval.applied_minor;
  const canRedeem =
    online &&
    Boolean(customer) &&
    Boolean(program?.enabled) &&
    (customer?.loyaltyPoints ?? 0) > 0;
  const maxRedeem = canRedeem && program
    ? Math.min(
        customer?.loyaltyPoints ?? 0,
        Math.floor(afterVoucher / Math.max(1, program.point_value_minor)),
      )
    : 0;
  const redeemed = canRedeem
    ? evaluateLoyaltyRedeem({
        program: {
          enabled: program!.enabled,
          earn_per_minor: program!.earn_per_minor,
          point_value_minor: program!.point_value_minor,
          expire_days: program!.expire_days,
          tiers: program!.tiers,
        },
        points_balance: customer?.loyaltyPoints ?? 0,
        redeem_points: Math.min(Math.max(0, redeemInput), maxRedeem),
        payable_minor: afterVoucher,
      })
    : { ok: true as const, redeem_points: 0, discount_minor: 0, skipped: true };
  const discount =
    redeemed.ok && !redeemed.skipped ? redeemed.discount_minor : 0;
  const appliedRedeem =
    redeemed.ok && !redeemed.skipped ? redeemed.redeem_points : 0;
  const payable = stackSaleDiscounts({
    line_total_minor: lineTotal,
    promo_discount_minor: promoEval.discount_minor,
    manager_discount_minor: managerEval.discount_minor,
    voucher_minor: voucherEval.applied_minor,
    loyalty_discount_minor: discount,
  });
  const creditBalance = customer?.storeCreditMinor ?? 0;
  const maxCredit = Math.max(0, Math.min(creditBalance, payable));
  const appliedCredit = customer ? Math.min(Math.max(0, creditMinor), maxCredit) : 0;
  const cashMinor = payable - appliedCredit;

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
    try {
      setProgram(await getLoyaltyProgram());
      setPromos(await getCachedPromotions());
      setSale(
        await createIncompleteSale({
          lines: lines.map(({ productId, name, priceMinor, qty }) => ({
            productId,
            name,
            priceMinor,
            qty,
          })),
          customerId: customer?.customerId ?? null,
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
      const liveProgram = await getLoyaltyProgram();
      const livePromo = evaluatePromotions({
        promotions: livePromos,
        lines: sale.lines.map((line) => ({
          product_id: line.productId,
          qty: line.qty,
          price_minor: line.priceMinor,
        })),
        coupon_code: couponCode,
        customer_group: customer?.groupName ?? null,
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
      const afterVoucherSale = afterManagerSale - liveVoucher.applied_minor;
      const liveRedeem =
        customer && liveProgram?.enabled && navigator.onLine
          ? evaluateLoyaltyRedeem({
            program: {
              enabled: liveProgram.enabled,
              earn_per_minor: liveProgram.earn_per_minor,
              point_value_minor: liveProgram.point_value_minor,
              expire_days: liveProgram.expire_days,
              tiers: liveProgram.tiers,
            },
            points_balance: customer?.loyaltyPoints ?? 0,
            redeem_points: Math.min(
              Math.max(0, redeemInput),
              Math.min(
                customer?.loyaltyPoints ?? 0,
                Math.floor(
                  afterVoucherSale / Math.max(1, liveProgram.point_value_minor),
                ),
              ),
            ),
            payable_minor: afterVoucherSale,
          })
        : { ok: true as const, redeem_points: 0, discount_minor: 0, skipped: true };
      const loyaltyDiscount =
        liveRedeem.ok && !liveRedeem.skipped ? liveRedeem.discount_minor : 0;
      const loyaltyRedeem =
        liveRedeem.ok && !liveRedeem.skipped ? liveRedeem.redeem_points : 0;
      const payableSale = stackSaleDiscounts({
        line_total_minor: lineTotalSale,
        promo_discount_minor: livePromo.discount_minor,
        manager_discount_minor: liveManager.discount_minor,
        voucher_minor: liveVoucher.applied_minor,
        loyalty_discount_minor: loyaltyDiscount,
      });
      const credit = customer
        ? Math.min(
            Math.max(0, creditMinor),
            Math.max(0, Math.min(creditBalance, payableSale)),
          )
        : 0;
      const cash = payableSale - credit;
      const completed = await completeSale(
        sale.saleId,
        {
          tenders: [
            ...(cash > 0 || credit === 0
              ? [{ method: "cash" as const, amountMinor: cash }]
              : []),
            ...(credit > 0
              ? [{ method: "store_credit" as const, amountMinor: credit }]
              : []),
          ],
        },
        loyaltyRedeem > 0 || loyaltyDiscount > 0
          ? { redeemPoints: loyaltyRedeem, discountMinor: loyaltyDiscount }
          : null,
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
      clear();
      setSale(null);
      setReceipt(t.receiptSuccess);
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
        err.message === "TENDER_SUM_MISMATCH"
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
          customerId: customer?.customerId ?? null,
          customerName: customer?.name ?? null,
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
          };
        }),
      );
      setCustomer(await restoreCartCustomer(record.customerId ?? null));
      await discardParkedCart(parkId);
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

  return (
    <aside
      id="cart-panel"
      className="fixed inset-x-3 bottom-3 z-30 flex max-h-[min(70dvh,36rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] md:static md:inset-auto md:bottom-auto md:z-auto md:h-full md:max-h-none md:min-h-0"
    >
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
      <h2 className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 text-lg font-semibold tracking-tight text-foreground sm:px-5">
        <ShoppingCartIcon size={22} weight="duotone" className="text-primary" />
        {t.cart}
      </h2>
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
        <div className="mt-1 min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <p className="font-medium">
            {appliedCredit > 0 ? t.storeCredit : t.cashPayment}{" "}
            {formatIdr(payable, lang)}
          </p>
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
          {customer ? (
            <div className="space-y-2 text-sm">
              {(customer.loyaltyPoints ?? 0) > 0 || customer.loyaltyTier ? (
                <p className="text-muted-foreground">
                  {t.loyaltyPoints}: {customer.loyaltyPoints ?? 0}
                  {customer.loyaltyTier ? ` · ${customer.loyaltyTier}` : ""}
                </p>
              ) : null}
              {canRedeem ? (
                <Label className="flex items-center justify-between gap-2 font-normal">
                  <span>{t.loyaltyRedeem}</span>
                  <Input
                    type="number"
                    min={0}
                    max={maxRedeem}
                    step={1}
                    value={appliedRedeem}
                    disabled={busy || maxRedeem <= 0}
                    className="h-8 w-32 text-right"
                    onChange={(e) => {
                      const next = parseGroupedInt(e.target.value);
                      setRedeemInput(
                        Number.isInteger(next)
                          ? Math.min(Math.max(0, next), maxRedeem)
                          : 0,
                      );
                    }}
                  />
                </Label>
              ) : customer && !online ? (
                <p className="text-muted-foreground">{t.loyaltyOffline}</p>
              ) : null}
              {discount > 0 ? (
                <p className="flex justify-between">
                  <span>{t.loyaltyDiscount}</span>
                  <span>-{formatIdr(discount, lang)}</span>
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {t.storeCreditBalance}: {formatIdr(creditBalance, lang)}
              </p>
              <Label className="flex items-center justify-between gap-2 font-normal">
                <span>{t.storeCredit}</span>
                <Input
                  type="number"
                  min={0}
                  max={maxCredit}
                  step={1}
                  value={appliedCredit}
                  disabled={busy || maxCredit <= 0}
                  className="h-8 w-32 text-right"
                  onChange={(e) => {
                    const next = parseGroupedInt(e.target.value);
                    setCreditMinor(
                      Number.isInteger(next)
                        ? Math.min(Math.max(0, next), maxCredit)
                        : 0,
                    );
                  }}
                />
              </Label>
              <p className="flex justify-between">
                <span>{t.cashTender}</span>
                <span>{formatIdr(cashMinor, lang)}</span>
              </p>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">{t.receiptHint}</p>
          <Button
            className="h-12 min-h-12 w-full rounded-xl"
            disabled={busy}
            onClick={() => void confirmReceipt()}
          >
            {busy ? t.pending : t.confirmReceipt}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-12 w-full text-sm text-muted-foreground"
            disabled={busy}
            onClick={() => void cancelCheckout()}
          >
            {t.cancelCheckout}
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 sm:px-5 sm:pt-5">
          {parked.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t.parked}</p>
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
            </div>
          ) : null}
          <CustomerAttach lang={lang} disabled={busy} />
          {lines.length === 0 ? (
            <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <ShoppingCartIcon
                size={40}
                weight="duotone"
                className="text-muted-foreground/50"
              />
              <p className="text-sm text-muted-foreground">{t.cartEmpty}</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
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
                          if (line.qty < line.stockQty) {
                            setQty(line.productId, line.qty + 1);
                            return;
                          }
                          const catalog = catalogById.get(line.productId);
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
                variant="ghost"
                disabled={busy}
                className="mt-2 h-12 min-h-12 w-full text-sm text-muted-foreground"
                onClick={() => void holdCart()}
              >
                <PauseIcon size={16} weight="bold" />
                {t.hold}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
