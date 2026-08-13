import { postVoid, type PostVoidResult } from "@pos-apps/domain";
import type { LocalSaleLine, LocalSaleRecord } from "./db.js";
import { endOfLocalDay, startOfLocalDay } from "./day-bounds.js";

export function evaluateVoid(
  sale: Pick<LocalSaleRecord, "status" | "completedAt" | "voidedAt" | "lines">,
  now: Date = new Date(),
): PostVoidResult {
  const completed = sale.completedAt ? Date.parse(sale.completedAt) : NaN;
  const start = startOfLocalDay(now).getTime();
  const end = endOfLocalDay(now).getTime();
  const sameCalendarDay =
    Number.isFinite(completed) && completed >= start && completed < end;
  return postVoid({
    sale_status: sale.status,
    already_voided: Boolean(sale.voidedAt),
    already_returned: false,
    same_calendar_day: sameCalendarDay,
    lines: sale.lines.map((line) => ({
      product_id: line.productId,
      qty: line.qty,
    })),
  });
}

export function restoreCatalogQty(
  lines: LocalSaleLine[],
  stockQty: (productId: string) => number | undefined,
): Map<string, number> {
  const next = new Map<string, number>();
  for (const line of lines) {
    const current = stockQty(line.productId);
    if (current === undefined) continue;
    next.set(line.productId, (next.get(line.productId) ?? current) + line.qty);
  }
  return next;
}
