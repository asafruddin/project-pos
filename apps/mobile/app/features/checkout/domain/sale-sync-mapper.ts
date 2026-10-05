import type { SyncSaleRequest, SyncVoidRequest } from "@pos-apps/types";
import type { CompletedSale } from "./sale";

/** Local sale → body of POST /sales/sync (same contract as the cashier PWA). */
export function toSyncSaleRequest(sale: CompletedSale): SyncSaleRequest {
  const promo = sale.promotions;
  const hasPromo =
    promo !== null &&
    (promo.discountMinor > 0 || promo.voucherMinor > 0 || promo.managerDiscountMinor > 0 || Boolean(promo.couponCode));
  return {
    sale_id: sale.saleId,
    device_id: sale.deviceId,
    completed_at: sale.completedAt,
    payment: {
      method: sale.payment.method,
      amount_minor: sale.payment.amountMinor,
      ...(sale.payment.tenders.length
        ? { tenders: sale.payment.tenders.map((t) => ({ method: t.method, amount_minor: t.amountMinor })) }
        : {}),
    },
    lines: sale.lines.map((l) => ({ product_id: l.productId, qty: l.qty, price_minor: l.priceMinor })),
    ...(sale.customerId ? { customer_id: sale.customerId } : {}),
    ...(sale.guestName?.trim() ? { guest_name: sale.guestName.trim() } : {}),
    shift_id: sale.shiftId,
    ...(hasPromo && promo
      ? {
          promotions: {
            discount_minor: promo.discountMinor,
            coupon_code: promo.couponCode,
            voucher_code: promo.voucherCode,
            voucher_minor: promo.voucherMinor,
            manager_discount_minor: promo.managerDiscountMinor,
            applied: promo.applied.map((row) => ({
              promotion_id: row.promotionId,
              name: row.name,
              discount_minor: row.discountMinor,
            })),
          },
        }
      : {}),
  };
}

export function toSyncVoidRequest(input: { voidId: string; saleId: string; voidedAt: string }): SyncVoidRequest {
  return { void_id: input.voidId, sale_id: input.saleId, voided_at: input.voidedAt };
}
