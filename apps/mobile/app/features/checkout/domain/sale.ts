import type { TenderMethod } from "@pos-apps/types";

export type SaleLine = {
  productId: string;
  name: string;
  qty: number;
  priceMinor: number;
};

export type SaleTender = { method: TenderMethod; amountMinor: number };

/** Discount snapshot stored with the sale and sent to the API (AD-10). */
export type SalePromotions = {
  discountMinor: number;
  couponCode: string | null;
  voucherCode: string | null;
  voucherMinor: number;
  managerDiscountMinor: number;
  applied: { promotionId: string; name: string; discountMinor: number }[];
};

export type CompletedSale = {
  saleId: string;
  deviceId: string;
  createdAt: string;
  completedAt: string;
  lines: SaleLine[];
  payment: {
    method: "cash" | "store_credit" | "qris" | "split";
    amountMinor: number;
    tenders: SaleTender[];
  };
  promotions: SalePromotions | null;
  customerId: string | null;
  guestName: string | null;
  /** Receipt queue number assigned on this device; null for sales made before queue numbers. */
  queueNumber: number | null;
  shiftId: string;
  voidedAt: string | null;
  voidId: string | null;
};

export function saleSubtotal(sale: Pick<CompletedSale, "lines">): number {
  return sale.lines.reduce((sum, line) => sum + line.priceMinor * line.qty, 0);
}

export function saleDiscountMinor(sale: Pick<CompletedSale, "promotions">): number {
  const p = sale.promotions;
  return p ? p.discountMinor + p.voucherMinor + p.managerDiscountMinor : 0;
}
