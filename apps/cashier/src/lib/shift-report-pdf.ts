import type { ShiftReport } from "@pos-apps/local-db";
import { jsPDF } from "jspdf";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const LINE = 5.6;

/** jsPDF's built-in fonts are Latin-1: swap the minus sign and keep names printable. */
function safe(text: string): string {
  return text.replace(/−/g, "-").replace(/[^ -ÿ]/g, "?");
}

function dateTime(iso: string, lang: LangPref): string {
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Draw the shift recap into an A4 PDF (text and simple tables, with page breaks). */
export function createShiftReportPdf(report: ShiftReport, lang: LangPref): jsPDF {
  const t = copy(lang);
  const money = (minor: number) => safe(formatIdr(minor, lang));
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensure = (height: number) => {
    if (y + height <= PAGE_H - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };
  const text = (value: string, x: number, opts?: { align?: "left" | "right"; size?: number; bold?: boolean; gray?: boolean }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(opts?.gray ? 110 : 17);
    doc.text(safe(value), x, y, { align: opts?.align ?? "left" });
  };
  const heading = (value: string) => {
    ensure(14);
    y += 6;
    text(value, MARGIN, { size: 12, bold: true });
    y += 2;
    doc.setDrawColor(200);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += LINE;
  };
  const kv = (label: string, value: string, bold = false) => {
    ensure(LINE + 1);
    text(label, MARGIN, { bold });
    text(value, PAGE_W - MARGIN, { align: "right", bold });
    y += LINE;
  };

  text(t.pdfTitle, MARGIN, { size: 18, bold: true });
  y += 6;
  text(report.storeName, MARGIN, { gray: true });
  y += LINE;
  text(
    `${t.pdfOpened}: ${dateTime(report.openedAt, lang)}${report.closedAt ? `   ${t.pdfClosed}: ${dateTime(report.closedAt, lang)}` : ""}`,
    MARGIN,
    { gray: true },
  );
  y += LINE;

  const r = report.recap;

  // Summary card (same layout as the Shift screen): Kas, Penjualan, Total keseluruhan.
  ensure(100);
  y += 6;
  const cardTop = y;
  y += 9;
  text(t.shiftSummary, MARGIN + 6, { size: 16, bold: true });
  const inner = (label: string, value: string) => {
    text(label, MARGIN + 6, { size: 11 });
    text(value, PAGE_W - MARGIN - 6, { align: "right", size: 11 });
    y += LINE + 0.6;
  };
  const rule = () => {
    doc.setDrawColor(210);
    doc.line(MARGIN + 6, y - 2, PAGE_W - MARGIN - 6, y - 2);
    y += 4;
  };
  y += 7;
  text(t.shiftSectionCash, MARGIN + 6, { size: 9, bold: true, gray: true });
  y += LINE;
  inner(t.shiftOpening, money(r.openingCashMinor));
  if (r.cashInMinor > 0) inner(t.shiftCashIn, money(r.cashInMinor));
  inner(t.shiftCashOut, `-${money(r.cashOutMinor)}`);
  inner(t.shiftRefunds, `-${money(r.cashRefundsMinor)}`);
  inner(t.shiftVoids, `-${money(r.cashVoidsMinor)}`);
  y += 1;
  rule();
  text(t.shiftSectionSales, MARGIN + 6, { size: 9, bold: true, gray: true });
  y += LINE;
  inner(t.shiftMethodCash, money(report.totals.cashMinor));
  inner(t.qris, money(report.totals.qrisMinor));
  if (report.totals.storeCreditMinor > 0) inner(t.storeCredit, money(report.totals.storeCreditMinor));
  y += 1;
  rule();
  y += 3;
  text(t.shiftGrandTotal, MARGIN + 6, { size: 12, bold: true });
  text(money(r.grandTotalMinor), PAGE_W - MARGIN - 6, { align: "right", size: 20, bold: true });
  y += LINE + 1;
  const hint = doc.splitTextToSize(safe(t.shiftGrandTotalHint), PAGE_W - MARGIN * 2 - 12) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(hint, MARGIN + 6, y);
  y += hint.length * 4 + 3;
  doc.setDrawColor(150);
  doc.roundedRect(MARGIN, cardTop, PAGE_W - MARGIN * 2, y - cardTop, 3, 3, "S");
  y += 7;
  kv(t.shiftFinalCash, money(r.finalCashMinor), true);
  if (!report.refundsKnown) {
    text(t.pdfRefundsUnknown, MARGIN, { size: 8, gray: true });
    y += LINE;
  }

  heading(t.pdfCashOutTitle);
  if (report.cashOuts.length === 0) {
    text(t.pdfNone, MARGIN, { gray: true });
    y += LINE;
  }
  for (const entry of report.cashOuts) {
    ensure(LINE + 1);
    text(dateTime(entry.occurredAt, lang), MARGIN, { size: 9, gray: true });
    text(entry.reason, MARGIN + 42, { size: 9 });
    text(`-${money(entry.amountMinor)}`, PAGE_W - MARGIN, { align: "right", size: 9 });
    y += LINE;
  }

  heading(t.pdfSalesTitle);
  kv(t.pdfSalesCount, String(report.totals.salesCount));
  kv(t.pdfVoidedCount, String(report.totals.voidedCount));

  y += 3;
  const header = () => {
    ensure(LINE * 2);
    text(t.pdfQueue, MARGIN, { size: 8, bold: true, gray: true });
    text(t.pdfTime, MARGIN + 16, { size: 8, bold: true, gray: true });
    text(t.pdfName, MARGIN + 62, { size: 8, bold: true, gray: true });
    text(t.pdfMethod, MARGIN + 112, { size: 8, bold: true, gray: true });
    text(t.pdfAmount, PAGE_W - MARGIN, { align: "right", size: 8, bold: true, gray: true });
    y += LINE;
  };
  header();
  if (report.sales.length === 0) {
    text(t.pdfNone, MARGIN, { gray: true });
    y += LINE;
  }
  for (const sale of report.sales) {
    if (y + LINE > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      header();
    }
    const method =
      [sale.cashMinor > 0 ? "Cash" : "", sale.qrisMinor > 0 ? "QRIS" : "", sale.storeCreditMinor > 0 ? "Store credit" : ""]
        .filter(Boolean)
        .join(" + ") || "-";
    const gray = sale.voided;
    text(sale.queueNumber ? `#${sale.queueNumber}` : "-", MARGIN, { size: 9, gray });
    text(dateTime(sale.completedAt, lang), MARGIN + 16, { size: 9, gray });
    text(`${sale.guestName ?? t.txWalkIn}${sale.voided ? ` (${t.pdfVoidedTag})` : ""}`.slice(0, 26), MARGIN + 62, { size: 9, gray });
    text(method, MARGIN + 112, { size: 9, gray });
    text(money(sale.amountMinor), PAGE_W - MARGIN, { align: "right", size: 9, gray });
    y += LINE;
  }

  y += 4;
  ensure(LINE * 2);
  const note = doc.splitTextToSize(safe(t.pdfAutoNote), PAGE_W - MARGIN * 2) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(note, MARGIN, y);
  return doc;
}

export type ShiftPdfFile = { blob: Blob; fileName: string };

/** `<store-name>-<generated-date>.pdf`, e.g. `Warung-Maju-2026-10-09.pdf`. */
export function shiftReportFileName(storeName: string, generatedAt: Date = new Date()): string {
  const store =
    storeName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shift";
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}`;
  return `${store}-${date}.pdf`;
}

export function shiftReportPdfFile(report: ShiftReport, lang: LangPref): ShiftPdfFile {
  const doc = createShiftReportPdf(report, lang);
  return { blob: doc.output("blob"), fileName: shiftReportFileName(report.storeName) };
}

/** Web Share with the PDF file when supported, otherwise download it. Resolves true when shared/downloaded. */
export async function shareShiftPdf(file: ShiftPdfFile): Promise<"shared" | "downloaded" | "cancelled"> {
  const pdf = new File([file.blob], file.fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [pdf] })) {
    try {
      await nav.share({ files: [pdf], title: file.fileName });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
