import { evaluateSplitTender, nextQueueNumber } from "@pos-apps/domain";
import { AppError, isAppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { Cart } from "@/features/cart/domain/cart";
import type { PinService } from "@/features/pin/domain/pin-service";
import type { PromotionRepository, VoucherRemote } from "@/features/promotions/domain/ports";
import type { QueueSettingsStore } from "@/features/queue/domain/queue-settings";
import type { ShiftRepository } from "@/features/shift/domain/ports";
import { startOfLocalDay } from "@/utils/day";
import type { DeviceIdProvider, SalesRepository } from "./ports";
import { cashChange, priceCart, type PricingBreakdown } from "./pricing";
import type { CompletedSale } from "./sale";

export type CompleteSaleInput = {
  cart: Cart;
  method: "cash" | "qris";
  /** Cash handed over (cash only). */
  cashReceivedMinor?: number | null;
  guestName?: string | null;
  couponCode?: string | null;
  voucherCode?: string | null;
  managerDiscountMinor?: number;
  managerPin?: string;
};

export type CompleteSaleErrorCode =
  | "CART_EMPTY"
  | "NO_OPEN_SHIFT"
  | "MANAGER_PIN_REQUIRED"
  | "MANAGER_PIN_LOCKED"
  | "VOUCHER_INVALID"
  | "CASH_SHORT"
  | "TENDER_SUM_MISMATCH"
  | "TENDER_METHOD_UNSUPPORTED"
  | "TENDER_CASH_QRIS_MIX"
  | "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER"
  | "TENDER_STORE_CREDIT_EXCEEDS_BALANCE";

/**
 * Completing a sale only ever touches the local database. The sale is queued
 * for sync in the same transaction, so a sale can never be lost or sent twice.
 * Pricing is re-evaluated here with fresh inputs (same as the PWA's confirm step).
 */
export class CompleteSaleUseCase {
  constructor(
    private readonly sales: SalesRepository,
    private readonly shifts: ShiftRepository,
    private readonly promotions: PromotionRepository,
    private readonly vouchers: VoucherRemote,
    private readonly pins: PinService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly device: DeviceIdProvider,
    private readonly online: () => boolean,
    private readonly onQueued: () => void,
    private readonly queue: QueueSettingsStore,
  ) {}

  async execute(input: CompleteSaleInput): Promise<CompletedSale> {
    if (input.cart.lines.length === 0) throw new AppError("VALIDATION", "CART_EMPTY");
    const shift = this.shifts.getOpen();
    if (!shift) throw new AppError("NO_OPEN_SHIFT");

    const managerMinor = input.managerDiscountMinor ?? 0;
    const lines = input.cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, priceMinor: l.priceMinor }));
    const base = { lines, promotions: this.promotions.get(), couponCode: input.couponCode, localHour: new Date(this.clock.nowMs()).getHours() };

    // A manager discount needs a manager's PIN, checked against the amount that would apply.
    const preview = priceCart({ ...base, managerDiscountMinor: managerMinor });
    if (preview.managerDiscountMinor > 0) await this.requireManagerPin(input.managerPin);

    const voucherRemaining = await this.resolveVoucher(input.voucherCode);
    const pricing = priceCart({ ...base, managerDiscountMinor: managerMinor, voucherRemainingMinor: voucherRemaining });

    if (input.method === "cash" && pricing.payableMinor > 0) {
      const { short } = cashChange(pricing.payableMinor, input.cashReceivedMinor ?? null);
      if (short) throw new AppError("VALIDATION", "CASH_SHORT");
    }

    const tender = evaluateSplitTender({
      payable_minor: pricing.payableMinor,
      tenders: [{ method: input.method, amount_minor: pricing.payableMinor }],
    });
    if (!tender.ok) throw new AppError("VALIDATION", tender.code);

    const now = this.clock.nowIso();
    // No awaits between here and recordCompletedSale, so two sales never share a number.
    const queueNumber = this.nextQueueNumber(now, shift.openedAt);
    const sale: CompletedSale = {
      saleId: this.ids.uuid(),
      deviceId: this.device.getDeviceId(),
      createdAt: now,
      completedAt: now,
      lines: input.cart.lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, priceMinor: l.priceMinor })),
      payment: {
        method: tender.method,
        amountMinor: tender.amount_minor,
        tenders: tender.tenders.map((t) => ({ method: t.method, amountMinor: t.amount_minor })),
      },
      promotions: this.snapshot(pricing, input.couponCode, voucherRemaining !== null ? input.voucherCode : null),
      customerId: null,
      guestName: input.guestName?.trim() || null,
      queueNumber,
      shiftId: shift.shiftId,
      voidedAt: null,
      voidId: null,
    };
    this.sales.recordCompletedSale(sale);
    this.onQueued();
    return sale;
  }

  private nextQueueNumber(nowIso: string, shiftOpenedAt: string): number {
    const settings = this.queue.get();
    const dayStart = startOfLocalDay(new Date(nowIso)).toISOString();
    // Fetch only as far back as the queue window can reach; nextQueueNumber applies the exact cut.
    const since =
      settings.mode === "daily" ? dayStart : settings.mode === "shift" ? shiftOpenedAt : (settings.resetAt ?? "1970-01-01T00:00:00.000Z");
    return nextQueueNumber({
      mode: settings.mode,
      resetAt: settings.resetAt,
      dayStart,
      shiftOpenedAt,
      sales: this.sales.listCompletedSince(since),
    });
  }

  private snapshot(pricing: PricingBreakdown, coupon?: string | null, voucherCode?: string | null): CompletedSale["promotions"] {
    const couponCode = coupon?.trim() ? coupon.trim().toUpperCase() : null;
    const used = pricing.promoDiscountMinor > 0 || pricing.voucherMinor > 0 || pricing.managerDiscountMinor > 0 || couponCode;
    if (!used) return null;
    return {
      discountMinor: pricing.promoDiscountMinor,
      couponCode,
      voucherCode: pricing.voucherMinor > 0 && voucherCode?.trim() ? voucherCode.trim().toUpperCase() : null,
      voucherMinor: pricing.voucherMinor,
      managerDiscountMinor: pricing.managerDiscountMinor,
      applied: pricing.appliedPromotions,
    };
  }

  private async requireManagerPin(pin: string | undefined): Promise<void> {
    if (!pin || !/^\d{6}$/.test(pin)) throw new AppError("VALIDATION", "MANAGER_PIN_REQUIRED");
    const result = await this.pins.verifyManager(pin);
    if (result.ok) return;
    throw new AppError("VALIDATION", result.reason === "locked" ? "MANAGER_PIN_LOCKED" : "MANAGER_PIN_REQUIRED");
  }

  /** Vouchers need the server; offline they are skipped (the PWA shows "voucher needs connection"). */
  private async resolveVoucher(code: string | null | undefined): Promise<number | null> {
    if (!code?.trim() || !this.online()) return null;
    try {
      const voucher = await this.vouchers.lookup(code);
      return voucher.enabled === false ? Promise.reject(new AppError("VALIDATION", "VOUCHER_INVALID")) : voucher.remaining_minor;
    } catch (error) {
      if (isAppError(error) && error.code === "VALIDATION") throw error;
      throw new AppError("VALIDATION", "VOUCHER_INVALID");
    }
  }
}
