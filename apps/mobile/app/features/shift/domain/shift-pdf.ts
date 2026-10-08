import type { ShiftReport } from "@pos-apps/domain";

export type ShiftPdfLabels = {
  title: string;
  opened: string;
  closed: string;
  recap: string;
  opening: string;
  cashSales: string;
  cashIn: string;
  cashOut: string;
  refunds: string;
  voids: string;
  finalCash: string;
  grandTotal: string;
  grandTotalHint: string;
  summary: string;
  sectionCash: string;
  sectionSales: string;
  methodCash: string;
  methodQris: string;
  methodStoreCredit: string;
  refundsUnknown: string;
  autoNote: string;
  cashOutTitle: string;
  none: string;
  salesTitle: string;
  totalCash: string;
  totalQris: string;
  totalStoreCredit: string;
  totalSales: string;
  salesCount: string;
  voidedCount: string;
  queue: string;
  time: string;
  name: string;
  method: string;
  amount: string;
  voidedTag: string;
  walkIn: string;
};

/** Turns a shift report into a shareable PDF file. */
export interface ShiftPdf {
  /** Render the report and return the local file URI. */
  create(report: ShiftReport, lang: "id" | "en"): Promise<string>;
  /** Open the system share sheet for a file made by `create`. Throws `AppError` when unavailable. */
  share(uri: string): Promise<void>;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Self-contained HTML for `expo-print` (A4 portrait). Pure, so it is unit-testable. */
export function renderShiftReportHtml(
  report: ShiftReport,
  labels: ShiftPdfLabels,
  money: (minor: number) => string,
  dateTime: (iso: string) => string,
): string {
  const e = escapeHtml;
  const r = report.recap;
  const row = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="strong"' : ""}><td>${e(label)}</td><td class="num">${e(value)}</td></tr>`;

  const cashOuts = report.cashOuts.length
    ? report.cashOuts
        .map((c) => `<tr><td>${e(dateTime(c.occurredAt))}</td><td>${e(c.reason)}</td><td class="num">−${e(money(c.amountMinor))}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">${e(labels.none)}</td></tr>`;

  const method = (s: ShiftReport["sales"][number]) =>
    [s.cashMinor > 0 ? "Cash" : "", s.qrisMinor > 0 ? "QRIS" : "", s.storeCreditMinor > 0 ? "Store credit" : ""].filter(Boolean).join(" + ") || "-";

  const sales = report.sales.length
    ? report.sales
        .map(
          (s) =>
            `<tr${s.voided ? ' class="voided"' : ""}><td>${s.queueNumber ? `#${s.queueNumber}` : "-"}</td><td>${e(dateTime(s.completedAt))}</td><td>${e(s.guestName ?? labels.walkIn)}${s.voided ? ` (${e(labels.voidedTag)})` : ""}</td><td>${e(method(s))}</td><td class="num">${e(money(s.amountMinor))}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">${e(labels.none)}</td></tr>`;

  const line = (label: string, value: string) =>
    `<div class="line"><span>${e(label)}</span><span class="num">${e(value)}</span></div>`;
  const cashRows = [
    line(labels.opening, money(r.openingCashMinor)),
    r.cashInMinor > 0 ? line(labels.cashIn, money(r.cashInMinor)) : "",
    line(labels.cashOut, `−${money(r.cashOutMinor)}`),
    line(labels.refunds, `−${money(r.cashRefundsMinor)}`),
    line(labels.voids, `−${money(r.cashVoidsMinor)}`),
  ].join("");
  const salesRows = [
    line(labels.methodCash, money(report.totals.cashMinor)),
    line(labels.methodQris, money(report.totals.qrisMinor)),
    report.totals.storeCreditMinor > 0 ? line(labels.methodStoreCredit, money(report.totals.storeCreditMinor)) : "",
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#111;font-size:12px;margin:24px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}
  .sub{color:#555;margin:0} table{width:100%;border-collapse:collapse} td,th{padding:5px 6px;text-align:left;vertical-align:top}
  th{font-size:11px;color:#555;border-bottom:1px solid #ccc} .num{text-align:right;white-space:nowrap}
  .muted{color:#777} .voided td{color:#999;text-decoration:line-through}
  .note{margin-top:10px;color:#555;font-size:11px}
  .card{border:1px solid #bbb;border-radius:12px;padding:18px 20px;margin-top:16px}
  .card h3{font-size:20px;margin:0 0 12px}
  .sec{font-size:11px;font-weight:700;color:#777;margin:0 0 4px}
  .part{padding-top:12px;margin-top:12px;border-top:1px solid #ddd}
  .part:first-of-type{border-top:0;margin-top:0;padding-top:0}
  .line{display:flex;justify-content:space-between;font-size:14px;padding:5px 0}
  .grand{display:flex;justify-content:space-between;align-items:center}
  .grand b{font-size:15px} .grand .big{font-size:28px;font-weight:800}
  .hint{color:#777;font-size:11px;margin-top:6px}
  .final{display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:12px;padding:0 4px}
  </style></head><body>
  <h1>${e(labels.title)}</h1>
  <p class="sub">${e(report.storeName)}</p>
  <p class="sub">${e(labels.opened)}: ${e(dateTime(report.openedAt))}${report.closedAt ? ` · ${e(labels.closed)}: ${e(dateTime(report.closedAt))}` : ""}</p>

  <div class="card">
    <h3>${e(labels.summary)}</h3>
    <div class="part"><p class="sec">${e(labels.sectionCash)}</p>${cashRows}</div>
    <div class="part"><p class="sec">${e(labels.sectionSales)}</p>${salesRows}</div>
    <div class="part">
      <div class="grand"><b>${e(labels.grandTotal)}</b><span class="big">${e(money(r.grandTotalMinor))}</span></div>
      <p class="hint">${e(labels.grandTotalHint)}</p>
    </div>
  </div>
  <div class="final"><span>${e(labels.finalCash)}</span><span class="num">${e(money(r.finalCashMinor))}</span></div>
  ${report.refundsKnown ? "" : `<p class="note">${e(labels.refundsUnknown)}</p>`}

  <h2>${e(labels.cashOutTitle)}</h2>
  <table>${cashOuts}</table>
  <h2>${e(labels.salesTitle)}</h2>
  <table>
    ${row(labels.salesCount, String(report.totals.salesCount))}
    ${row(labels.voidedCount, String(report.totals.voidedCount))}
  </table>
  <table style="margin-top:10px"><thead><tr><th>${e(labels.queue)}</th><th>${e(labels.time)}</th><th>${e(labels.name)}</th><th>${e(labels.method)}</th><th class="num">${e(labels.amount)}</th></tr></thead><tbody>${sales}</tbody></table>
  <p class="note">${e(labels.autoNote)}</p>
  </body></html>`;
}
