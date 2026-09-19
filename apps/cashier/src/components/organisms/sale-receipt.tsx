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

function thermalPrintCss(heightMm: number): string {
  return `
    @page {
      size: ${RECEIPT_WIDTH_MM}mm ${heightMm}mm;
      margin: 0;
    }
    html {
      color-scheme: light !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #111 !important;
      font-size: 11pt !important;
      line-height: 1.35 !important;
    }
    .sale-receipt-print {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #111 !important;
    }
    .sale-receipt-page {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 2mm 2.5mm 16mm 2.5mm !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: #fff !important;
      color: #111 !important;
      box-sizing: border-box !important;
      break-after: page;
    }
    .sale-receipt-page:last-child { break-after: auto; }
    .sale-receipt-page .text-xs { font-size: 9.5pt !important; }
    .sale-receipt-page .text-sm { font-size: 11pt !important; }
    .sale-receipt-page .text-base { font-size: 13pt !important; }
    .sale-receipt-print .text-muted-foreground { color: #333 !important; }
    .sale-receipt-logo,
    .sale-receipt-print img {
      max-width: 28mm !important;
      max-height: 16mm !important;
      width: auto !important;
      height: auto !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  `;
}

function waitForPrintImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  ).then(() => undefined);
}

/** Chrome often still paginates A4. Fill 100% of the page box so 58mm roll printers are not shrunk. */
function printThermalReceipt() {
  const source = document.querySelector(".sale-receipt-print");
  if (!(source instanceof HTMLElement)) {
    window.print();
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "receipt-print");
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${RECEIPT_WIDTH_MM}mm;height:100vh;border:0;opacity:0;pointer-events:none;background:#fff`;
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
  clone.style.width = "100%";
  clone.style.maxWidth = "none";
  doc.body.appendChild(clone);

  const pages = Array.from(
    clone.querySelectorAll(".sale-receipt-page"),
  ) as HTMLElement[];
  const maxPx = Math.max(1, ...pages.map((page) => page.scrollHeight));
  const heightMm = Math.max(90, Math.ceil(pxToMm(maxPx) + 22));

  const pageStyle = doc.createElement("style");
  pageStyle.textContent = thermalPrintCss(heightMm);
  doc.head.appendChild(pageStyle);

  const cleanup = () => {
    iframe.remove();
  };
  iframe.contentWindow?.addEventListener("afterprint", cleanup);
  void waitForPrintImages(doc).then(() => {
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(cleanup, 60_000);
    }, 120);
  });
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
  storeName,
  storeLogoSrc,
}: {
  sale: LocalSaleRecord;
  customerName: string | null;
  lang: LangPref;
  storeName: string;
  storeLogoSrc: string | null;
}) {
  const t = copy(lang);
  const time = formatSaleTime(sale.completedAt ?? sale.createdAt, lang);
  const ref = shortSaleId(sale.saleId);
  const walkIn = !customerName;
  const discounts = discountRows(sale, t);
  const payable = sale.payment?.amountMinor ?? saleSubtotal(sale);
  const tenders = sale.payment?.tenders ?? [];

  return (
    <article className="sale-receipt-page sale-receipt-customer">
      <header className="text-center">
        <div className="mb-2 flex flex-col items-center gap-2">
          <StoreLogo
            src={storeLogoSrc}
            alt={storeName}
            size="lg"
            className="sale-receipt-logo mx-auto"
          />
          <p className="text-base font-bold tracking-wide">{storeName}</p>
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {t.receiptCustomerCopy}
        </p>
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
            <span className="min-w-0 flex-1">
              {line.name}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {line.qty} × {formatIdr(line.priceMinor, lang)}
              </span>
            </span>
            <span className="shrink-0 font-medium">
              {formatIdr(lineTotal(line.qty, line.priceMinor), lang)}
            </span>
          </li>
        ))}
      </ul>

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
      <p className="mt-4 text-center text-xs leading-snug">
        {t.receiptThanks.replace("{store}", storeName.trim() || "POS")}
      </p>
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
            <SaleReceiptCopy {...copyProps} />
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
            <SaleReceiptCopy {...copyProps} />
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
