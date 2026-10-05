import { evaluateManagerDiscount, evaluatePromotions, evaluateVoucher, stackSaleDiscounts } from "@pos-apps/domain";
import type { Promotion } from "@pos-apps/types";

export type PricingLine = { productId: string; qty: number; priceMinor: number };

export type PricingInput = {
  lines: PricingLine[];
  promotions: Promotion[];
  couponCode?: string | null;
  managerDiscountMinor?: number;
  /** Remaining balance of a looked-up voucher, or null when none / offline. */
  voucherRemainingMinor?: number | null;
  /** 0–23, for time-window promotions. */
  localHour?: number;
};

export type PricingBreakdown = {
  lineTotalMinor: number;
  promoDiscountMinor: number;
  appliedPromotions: { promotionId: string; name: string; discountMinor: number }[];
  couponInvalid: boolean;
  managerDiscountMinor: number;
  voucherMinor: number;
  payableMinor: number;
};

/**
 * Sale-level discount stack, in the PWA's order: promo → manager → voucher.
 * Pure: used for the live cart summary and again at confirm time with fresh inputs.
 */
export function priceCart(input: PricingInput): PricingBreakdown {
  const lineTotalMinor = input.lines.reduce((sum, l) => sum + l.priceMinor * l.qty, 0);
  const promo = evaluatePromotions({
    promotions: input.promotions,
    lines: input.lines.map((l) => ({ product_id: l.productId, qty: l.qty, price_minor: l.priceMinor })),
    coupon_code: input.couponCode ?? "",
    customer_group: null,
    local_hour: input.localHour,
  });
  const afterPromo = lineTotalMinor - promo.discount_minor;
  const manager = evaluateManagerDiscount({ discount_minor: input.managerDiscountMinor ?? 0, payable_minor: afterPromo });
  const afterManager = afterPromo - manager.discount_minor;
  const voucher =
    input.voucherRemainingMinor != null
      ? evaluateVoucher({ remaining_minor: input.voucherRemainingMinor, payable_minor: afterManager })
      : { applied_minor: 0 };
  const payableMinor = stackSaleDiscounts({
    line_total_minor: lineTotalMinor,
    promo_discount_minor: promo.discount_minor,
    manager_discount_minor: manager.discount_minor,
    voucher_minor: voucher.applied_minor,
    loyalty_discount_minor: 0,
  });
  return {
    lineTotalMinor,
    promoDiscountMinor: promo.discount_minor,
    appliedPromotions: promo.applied.map((a) => ({
      promotionId: a.promotion_id,
      name: a.name,
      discountMinor: a.discount_minor,
    })),
    couponInvalid: Boolean(input.couponCode?.trim()) && promo.coupon_error !== null,
    managerDiscountMinor: manager.discount_minor,
    voucherMinor: voucher.applied_minor,
    payableMinor,
  };
}

/** Change to hand back and whether the cash handed over is short of the amount due. */
export function cashChange(payableMinor: number, receivedMinor: number | null): { short: boolean; changeMinor: number; shortMinor: number } {
  if (receivedMinor === null || !Number.isInteger(receivedMinor)) {
    return { short: payableMinor > 0, changeMinor: 0, shortMinor: payableMinor };
  }
  if (receivedMinor < payableMinor) return { short: true, changeMinor: 0, shortMinor: payableMinor - receivedMinor };
  return { short: false, changeMinor: receivedMinor - payableMinor, shortMinor: 0 };
}
