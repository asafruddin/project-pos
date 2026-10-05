import { formatIdr } from "@/utils/money";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { EscPosBuilder, padRow, printerSafe } from "./escpos";

export type ReceiptLabels = {
  customerCopy: string;
  walkIn: string;
  voided: string;
  total: string;
  cash: string;
  qris: string;
  storeCredit: string;
  promoDiscount: string;
  voucher: string;
  managerDiscount: string;
  /** Contains `{store}`. */
  thanks: string;
};

export type ReceiptInput = {
  storeName: string;
  customerName?: string | null;
  labels: ReceiptLabels;
  /** Display locale for the timestamp. */
  locale?: string;
  lang?: "id" | "en";
};

function moneyOf(amountMinor: number, lang: "id" | "en"): string {
  return printerSafe(formatIdr(amountMinor, lang)) || `Rp${amountMinor}`;
}

function shortSaleId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ESC/POS bytes for the customer copy. Mirrors the cashier PWA's
 * `encodeCustomerCopy` (apps/cashier/src/lib/printer/print-job.ts) so printed
 * receipts look the same on both clients. Discounts/loyalty land with those features.
 */
export function encodeSaleReceipt(sale: CompletedSale, input: ReceiptInput): Uint8Array {
  const { labels } = input;
  const lang = input.lang ?? "id";
  const money = (n: number) => moneyOf(n, lang);
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.text(input.storeName || "POS");
  b.bold(false);
  b.text(labels.customerCopy);
  b.text(formatTime(sale.completedAt, input.locale ?? "id-ID"));
  b.text(shortSaleId(sale.saleId));
  if (sale.voidedAt) b.text(labels.voided);
  b.text(input.customerName?.trim() || sale.guestName?.trim() || labels.walkIn);
  b.align("left").separator();

  let subtotal = 0;
  for (const line of sale.lines) {
    const lineTotal = line.qty * line.priceMinor;
    subtotal += lineTotal;
    b.text(line.name);
    b.text(padRow(`${line.qty} x ${money(line.priceMinor)}`, money(lineTotal)));
  }

  b.separator();
  b.text(padRow(labels.total, money(subtotal)));
  for (const row of discountRows(sale, labels)) b.text(padRow(row.label, `-${money(row.amountMinor)}`));
  for (const tender of sale.payment.tenders) {
    const label =
      tender.method === "store_credit"
        ? labels.storeCredit
        : tender.method === "qris"
          ? labels.qris
          : labels.cash;
    b.text(padRow(label, money(tender.amountMinor)));
  }

  b.bold(true);
  b.text(padRow(labels.total, money(sale.payment.amountMinor)));
  b.bold(false);
  b.feed(1);
  b.align("center");
  b.text(labels.thanks.replace("{store}", input.storeName.trim() || "POS"));
  return b.cut().build();
}

export type DiscountRow = { label: string; amountMinor: number };

/** Discount lines shown on the receipt (preview dialog and ESC/POS share this). */
export function discountRows(
  sale: Pick<CompletedSale, "promotions">,
  labels: Pick<ReceiptLabels, "promoDiscount" | "voucher" | "managerDiscount">,
): DiscountRow[] {
  const promo = sale.promotions;
  if (!promo) return [];
  const rows: DiscountRow[] = [];
  if (promo.discountMinor > 0) rows.push({ label: labels.promoDiscount, amountMinor: promo.discountMinor });
  if (promo.voucherMinor > 0) {
    rows.push({ label: `${labels.voucher}${promo.voucherCode ? ` (${promo.voucherCode})` : ""}`, amountMinor: promo.voucherMinor });
  }
  if (promo.managerDiscountMinor > 0) rows.push({ label: labels.managerDiscount, amountMinor: promo.managerDiscountMinor });
  return rows;
}

export function encodeTestPage(storeName: string, nowLabel: string): Uint8Array {
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.text(storeName || "POS Apps");
  b.bold(false);
  b.text("TEST PRINT");
  b.text(nowLabel);
  b.feed(1);
  b.text("ESC/POS 58mm");
  return b.cut().build();
}
