import { formatIdr } from "@/utils/money";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { EscPosBuilder, padRow, printerSafe } from "./escpos";

export type ReceiptLabels = {
  customerCopy: string;
  kitchenCopy: string;
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
  queue: string;
  guest: string;
};

export type ReceiptInput = {
  storeName: string;
  customerName?: string | null;
  /** 1-based number for the local calendar day. */
  queueNumber?: number;
  labels: ReceiptLabels;
  /** Display locale for the timestamp. */
  locale?: string;
  lang?: "id" | "en";
};

/** Stable 1-based queue number for a sale among that local day's completed sales. */
export function queueNumberForDay(saleId: string, sales: { saleId: string; completedAt: string }[]): number {
  const ordered = [...sales].sort((a, b) => {
    const byTime = a.completedAt.localeCompare(b.completedAt);
    return byTime !== 0 ? byTime : a.saleId.localeCompare(b.saleId);
  });
  const index = ordered.findIndex((row) => row.saleId === saleId);
  return index >= 0 ? index + 1 : ordered.length + 1;
}

function guestNameOf(sale: CompletedSale, input: ReceiptInput): string {
  return input.customerName?.trim() || sale.guestName?.trim() || input.labels.walkIn;
}

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

function writeQueueAndGuest(b: EscPosBuilder, sale: CompletedSale, input: ReceiptInput): void {
  const { labels } = input;
  if (input.queueNumber && input.queueNumber > 0) {
    b.text(labels.queue);
    b.bold(true).size(2);
    b.text(`#${input.queueNumber}`);
    b.size(1);
  }
  b.bold(true);
  b.text(`${labels.guest}: ${guestNameOf(sale, input)}`);
  b.bold(false);
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
  writeQueueAndGuest(b, sale, input);
  b.text(formatTime(sale.completedAt, input.locale ?? "id-ID"));
  b.text(shortSaleId(sale.saleId));
  if (sale.voidedAt) b.text(labels.voided);
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

/**
 * Two kitchen tickets (item name + qty only) on one strip, with a short feed
 * between them so they tear apart without a long blank gap.
 */
export function encodeKitchenReceipt(sale: CompletedSale, input: ReceiptInput): Uint8Array {
  return concatBytes([encodeKitchenTicket(sale, input, false), encodeKitchenTicket(sale, input, true)]);
}

function encodeKitchenTicket(sale: CompletedSale, input: ReceiptInput, cut: boolean): Uint8Array {
  const { labels } = input;
  const b = new EscPosBuilder().init().align("center").bold(true);
  b.text(labels.kitchenCopy);
  b.bold(false);
  writeQueueAndGuest(b, sale, input);
  b.text(formatTime(sale.completedAt, input.locale ?? "id-ID"));
  if (sale.voidedAt) b.text(labels.voided);
  b.align("left").separator();
  for (const line of sale.lines) {
    b.text(padRow(line.name, `x${line.qty}`));
  }
  b.separator();
  return cut ? b.cut().build() : b.feed(2).build();
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
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
