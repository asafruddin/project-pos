"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import type { LocalSaleRecord } from "@pos-apps/local-db";
import { createPortal } from "react-dom";
import { useState } from "react";
import { StoreLogo } from "@pos-apps/ui/molecules";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";
import { getStoreIdentity } from "@/lib/auth-token";
import { useStoreLogoSrc } from "@/lib/use-store-logo";
import {
  canPrintViaBluetooth,
  printSaleViaBluetooth,
} from "@/lib/printer";

const RECEIPT_WIDTH_MM = 58;

function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

/** Chrome ignores `@page size: 58mm auto` and keeps A4. Print from an iframe with two explicit lengths. */
function printThermalReceipt() {
  const source = document.querySelector(".sale-receipt-print");
  if (!(source instanceof HTMLElement)) {
    window.print();
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "receipt-print");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:58mm;height:1px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`<!DOCTYPE html><html><head>${styles}</head><body></body></html>`);
  doc.close();

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("aria-hidden");
  clone.style.display = "block";
  clone.style.width = `${RECEIPT_WIDTH_MM}mm`;
  doc.body.style.margin = "0";
  doc.body.style.width = `${RECEIPT_WIDTH_MM}mm`;
  doc.documentElement.style.width = `${RECEIPT_WIDTH_MM}mm`;
  doc.body.appendChild(clone);

  const pages = Array.from(
    clone.querySelectorAll(".sale-receipt-page"),
  ) as HTMLElement[];
  const maxPx = Math.max(1, ...pages.map((page) => page.scrollHeight));
  const heightMm = Math.max(80, Math.ceil(pxToMm(maxPx) + 8));

  const pageStyle = doc.createElement("style");
  pageStyle.textContent = `
    @page { size: ${RECEIPT_WIDTH_MM}mm ${heightMm}mm; margin: 0; }
    html, body {
      width: ${RECEIPT_WIDTH_MM}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    .sale-receipt-print {
      display: block !important;
      width: ${RECEIPT_WIDTH_MM}mm;
      max-width: ${RECEIPT_WIDTH_MM}mm;
      padding: 0;
    }
    .sale-receipt-page {
      width: ${RECEIPT_WIDTH_MM}mm;
      max-width: ${RECEIPT_WIDTH_MM}mm;
      box-sizing: border-box;
      padding: 3mm 4mm;
      break-after: page;
      border: 0;
      background: transparent;
    }
    .sale-receipt-page:last-child { break-after: auto; }
  `;
  doc.head.appendChild(pageStyle);

  const cleanup = () => {
    iframe.remove();
  };
  iframe.contentWindow?.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(cleanup, 60_000);
  }, 80);
}

export function shortSaleId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

export function formatSaleTime(iso: string | undefined, lang: LangPref): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

type DiscountRow = { label: string; amount: number };

function discountRows(
  sale: LocalSaleRecord,
  t: ReturnType<typeof copy>,
): DiscountRow[] {
  const promo = sale.promotions;
  const rows: DiscountRow[] = [];
  if ((promo?.discountMinor ?? 0) > 0) {
    rows.push({ label: t.promoDiscount, amount: promo!.discountMinor });
  }
  if ((promo?.voucherMinor ?? 0) > 0) {
    const code = promo?.voucherCode ? ` (${promo.voucherCode})` : "";
    rows.push({ label: `${t.voucher}${code}`, amount: promo!.voucherMinor });
  }
  if ((promo?.managerDiscountMinor ?? 0) > 0) {
    rows.push({
      label: t.managerDiscount,
      amount: promo!.managerDiscountMinor,
    });
  }
  if ((sale.loyalty?.discountMinor ?? 0) > 0) {
    rows.push({
      label: t.loyaltyDiscount,
      amount: sale.loyalty!.discountMinor,
    });
  }
  return rows;
}

function SaleReceiptCopy({
  sale,
  customerName,
  lang,
  variant,
  storeName,
  storeLogoSrc,
}: {
  sale: LocalSaleRecord;
  customerName: string | null;
  lang: LangPref;
  variant: "customer" | "kitchen";
  storeName: string;
  storeLogoSrc: string | null;
}) {
  const t = copy(lang);
  const time = formatSaleTime(sale.completedAt ?? sale.createdAt, lang);
  const ref = shortSaleId(sale.saleId);
  const walkIn = !customerName;
  const kitchen = variant === "kitchen";
  const discounts = discountRows(sale, t);
  const payable = sale.payment?.amountMinor ?? saleSubtotal(sale);
  const tenders = sale.payment?.tenders ?? [];

  return (
    <article
      className={
        kitchen
          ? "sale-receipt-page sale-receipt-kitchen"
          : "sale-receipt-page sale-receipt-customer"
      }
    >
      <header className="text-center">
        {!kitchen ? (
          <div className="mb-2 flex flex-col items-center gap-2">
            <StoreLogo
              src={storeLogoSrc}
              alt={storeName}
              size="lg"
              className="sale-receipt-logo mx-auto"
            />
            <p className="text-base font-bold tracking-wide">{storeName}</p>
          </div>
        ) : (
          <p className="text-base font-bold tracking-wide">
            {t.receiptKitchenCopy}
          </p>
        )}
        {!kitchen ? (
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {t.receiptCustomerCopy}
          </p>
        ) : null}
        <p className="mt-2 text-xs">{time}</p>
        <p className="font-mono text-xs">{ref}</p>
        {sale.voidedAt ? (
          <p className="mt-1 text-xs font-semibold uppercase">{t.voided}</p>
        ) : null}
        <p className="mt-1 text-xs">
          {walkIn ? t.txWalkIn : customerName}
        </p>
      </header>

      <ul className="mt-4 space-y-1 border-y border-dashed border-border py-3 text-sm">
        {sale.lines.map((line) => (
          <li
            key={line.productId}
            className="flex items-start justify-between gap-3"
          >
            {kitchen ? (
              <span>
                {line.qty} × {line.name}
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  {line.name}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {line.qty} × {formatIdr(line.priceMinor, lang)}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatIdr(lineTotal(line.qty, line.priceMinor), lang)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      {!kitchen ? (
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt>{t.total}</dt>
            <dd>{formatIdr(saleSubtotal(sale), lang)}</dd>
          </div>
          {discounts.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt>{row.label}</dt>
              <dd>−{formatIdr(row.amount, lang)}</dd>
            </div>
          ))}
          {tenders.map((tender, index) => (
            <div
              key={`${tender.method}-${index}`}
              className="flex justify-between gap-3"
            >
              <dt>
                {tender.method === "store_credit"
                  ? t.storeCredit
                  : tender.method === "qris"
                    ? t.qris
                    : t.cashTender}
              </dt>
              <dd>{formatIdr(tender.amountMinor, lang)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
            <dt>{t.total}</dt>
            <dd>{formatIdr(payable, lang)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-right text-sm font-medium">
          {t.holdLineCount.replace(
            "{count}",
            String(sale.lines.reduce((sum, line) => sum + line.qty, 0)),
          )}
        </p>
      )}
    </article>
  );
}

export function SaleReceiptPreview({
  sale,
  customerName,
  lang,
  open,
  onClose,
}: {
  sale: LocalSaleRecord | null;
  customerName: string | null;
  lang: LangPref;
  open: boolean;
  onClose: () => void;
}) {
  const t = copy(lang);
  const store = getStoreIdentity();
  const storeLogoSrc = useStoreLogoSrc(store.storeLogoUrl);
  const storeName = store.storeName;
  const [printing, setPrinting] = useState(false);

  if (!sale) return null;

  const currentSale = sale;

  const copyProps = {
    sale: currentSale,
    customerName,
    lang,
    storeName,
    storeLogoSrc,
  } as const;

  const printRoot =
    typeof document !== "undefined"
      ? createPortal(
          <div className="sale-receipt-print" aria-hidden>
            <SaleReceiptCopy {...copyProps} variant="customer" />
            <SaleReceiptCopy {...copyProps} variant="kitchen" />
          </div>,
          document.body,
        )
      : null;

  async function printReceipt() {
    if (printing) return;
    if (canPrintViaBluetooth()) {
      setPrinting(true);
      try {
        await printSaleViaBluetooth({
          sale: currentSale,
          customerName,
          lang,
          storeName,
        });
        return;
      } catch {
        // BLE failed — fall through to the browser print dialog.
      } finally {
        setPrinting(false);
      }
    }
    printThermalReceipt();
  }

  return (
    <>
      {printRoot}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-4 overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.receiptPreviewTitle}</DialogTitle>
            <DialogDescription>{t.receiptPreviewHint}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <SaleReceiptCopy {...copyProps} variant="customer" />
            <SaleReceiptCopy {...copyProps} variant="kitchen" />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t.receiptClose}
            </Button>
            <Button type="button" onClick={() => void printReceipt()} disabled={printing}>
              {printing ? t.printerPrinting : t.printReceipt}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
