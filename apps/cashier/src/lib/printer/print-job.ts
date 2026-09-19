import type { LocalSaleRecord } from "@pos-apps/local-db";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";
import { getSavedBlePrinter } from "./storage";
import { EscPosBuilder, padRow, printerSafe } from "./escpos";
import {
  canUseWebBluetooth,
  printBytesToSavedPrinter,
} from "./bluetooth";

function money(amount: number, lang: LangPref): string {
  return printerSafe(formatIdr(amount, lang)) || `Rp${amount}`;
}

function lineTotal(qty: number, priceMinor: number): number {
  return qty * priceMinor;
}

function saleSubtotal(sale: LocalSaleRecord): number {
  return sale.lines.reduce(
    (sum, line) => sum + lineTotal(line.qty, line.priceMinor),
    0,
  );
}

function shortSaleId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

function formatSaleTime(iso: string | undefined, lang: LangPref): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function encodeCustomerCopy(
  sale: LocalSaleRecord,
  input: {
    customerName: string | null;
    lang: LangPref;
    storeName: string;
  },
): Uint8Array {
  const t = copy(input.lang);
  const builder = new EscPosBuilder().init().align("center").bold(true);
  builder.text(input.storeName || "POS");
  builder.bold(false);
  builder.text(t.receiptCustomerCopy);
  builder.text(formatSaleTime(sale.completedAt ?? sale.createdAt, input.lang));
  builder.text(shortSaleId(sale.saleId));
  if (sale.voidedAt) builder.text(t.voided);
  builder.text(input.customerName?.trim() || t.txWalkIn);
  builder.align("left").separator();

  for (const line of sale.lines) {
    builder.text(line.name);
    builder.text(
      padRow(
        `${line.qty} x ${money(line.priceMinor, input.lang)}`,
        money(lineTotal(line.qty, line.priceMinor), input.lang),
      ),
    );
  }

  builder.separator();
  const subtotal = saleSubtotal(sale);
  builder.text(padRow(t.total, money(subtotal, input.lang)));

  const promo = sale.promotions;
  if ((promo?.discountMinor ?? 0) > 0) {
    builder.text(padRow(t.promoDiscount, `-${money(promo!.discountMinor, input.lang)}`));
  }
  if ((promo?.voucherMinor ?? 0) > 0) {
    const code = promo?.voucherCode ? ` (${promo.voucherCode})` : "";
    builder.text(
      padRow(`${t.voucher}${code}`, `-${money(promo!.voucherMinor, input.lang)}`),
    );
  }
  if ((promo?.managerDiscountMinor ?? 0) > 0) {
    builder.text(
      padRow(
        t.managerDiscount,
        `-${money(promo!.managerDiscountMinor, input.lang)}`,
      ),
    );
  }
  if ((sale.loyalty?.discountMinor ?? 0) > 0) {
    builder.text(
      padRow(
        t.loyaltyDiscount,
        `-${money(sale.loyalty!.discountMinor, input.lang)}`,
      ),
    );
  }

  for (const tender of sale.payment?.tenders ?? []) {
    const label =
      tender.method === "store_credit"
        ? t.storeCredit
        : tender.method === "qris"
          ? t.qris
          : t.cashTender;
    builder.text(padRow(label, money(tender.amountMinor, input.lang)));
  }

  const payable = sale.payment?.amountMinor ?? subtotal;
  builder.bold(true);
  builder.text(padRow(t.total, money(payable, input.lang)));
  builder.bold(false);
  builder.feed(1);
  builder.align("center");
  builder.text(
    t.receiptThanks.replace("{store}", input.storeName.trim() || "POS"),
  );
  return builder.cut().build();
}

function encodeKitchenCopy(
  sale: LocalSaleRecord,
  input: { customerName: string | null; lang: LangPref },
): Uint8Array {
  const t = copy(input.lang);
  const builder = new EscPosBuilder().init().align("center").bold(true);
  builder.text(t.receiptKitchenCopy);
  builder.bold(false);
  builder.text(formatSaleTime(sale.completedAt ?? sale.createdAt, input.lang));
  builder.text(shortSaleId(sale.saleId));
  builder.text(input.customerName?.trim() || t.txWalkIn);
  builder.align("left").separator();
  for (const line of sale.lines) {
    builder.text(`${line.qty} x ${line.name}`);
  }
  builder.separator();
  const count = sale.lines.reduce((sum, line) => sum + line.qty, 0);
  builder.align("right");
  builder.text(t.holdLineCount.replace("{count}", String(count)));
  return builder.cut().build();
}

export function canPrintViaBluetooth(): boolean {
  return canUseWebBluetooth() && Boolean(getSavedBlePrinter());
}

export async function printSaleViaBluetooth(input: {
  sale: LocalSaleRecord;
  customerName: string | null;
  lang: LangPref;
  storeName: string;
}): Promise<void> {
  const customer = encodeCustomerCopy(input.sale, input);
  const kitchen = encodeKitchenCopy(input.sale, input);
  const payload = new Uint8Array(customer.length + kitchen.length);
  payload.set(customer, 0);
  payload.set(kitchen, customer.length);
  await printBytesToSavedPrinter(payload);
}

export async function printBluetoothTestPage(storeName: string): Promise<void> {
  const builder = new EscPosBuilder().init().align("center").bold(true);
  builder.text(storeName || "POS Apps");
  builder.bold(false);
  builder.text("TEST PRINT");
  builder.text(new Date().toLocaleString("id-ID"));
  builder.feed(1);
  builder.text("BLE ESC/POS 58mm");
  await printBytesToSavedPrinter(builder.cut().build());
}
