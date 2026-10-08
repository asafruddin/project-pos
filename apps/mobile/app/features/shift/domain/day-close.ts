import { dayCloseCashFromShifts, evaluateDayClose, qrisTenderTotal } from "@pos-apps/domain";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { endOfLocalDay, startOfLocalDay } from "@/utils/day";
import type { Shift } from "./shift";

export type DayCloseShiftCash = {
  shiftId: string;
  closedAt: string;
  expectedCashMinor: number;
  countedCashMinor: number;
  differenceMinor: number;
};

export type DayCloseQrisSale = { saleId: string; completedAt: string; amountMinor: number };

export type DayCloseSummary = {
  sales: CompletedSale[];
  totalMinor: number;
  transactionCount: number;
  pendingSyncSaleIds: string[];
  pendingSyncCount: number;
  openShift: Shift | null;
  closedShifts: DayCloseShiftCash[];
  shiftExpectedTotalMinor: number;
  shiftCountedTotalMinor: number;
  shiftDifferenceTotalMinor: number;
  qrisTotalMinor: number;
  qrisTransactionCount: number;
  qrisSales: DayCloseQrisSale[];
};

export function closedShiftsForLocalDay(rows: Shift[], day: Date): Shift[] {
  const start = startOfLocalDay(day).getTime();
  const end = endOfLocalDay(day).getTime();
  return rows.filter((row) => {
    if (row.status !== "closed" || !row.closedAt) return false;
    const t = Date.parse(row.closedAt);
    return Number.isFinite(t) && t >= start && t < end;
  });
}

/**
 * The shift the recap covers: the open one, otherwise the most recently closed one (so the screen is not
 * empty right after closing). Earlier shifts, even from the same day, are not part of the recap.
 */
export function currentShiftScope(rows: Shift[]): Shift | null {
  const open = rows.find((row) => row.status === "open");
  if (open) return open;
  const closed = rows.filter((row) => row.status === "closed");
  closed.sort((a, b) => Date.parse(b.closedAt ?? b.openedAt) - Date.parse(a.closedAt ?? a.openedAt));
  return closed[0] ?? null;
}

/** Port of `dayCloseSummaryFrom` (packages/local-db/src/day-close.ts). */
export function buildDayCloseSummary(input: {
  sales: CompletedSale[];
  unsyncedSaleIds: Set<string>;
  openShift: Shift | null;
  closedShifts: Shift[];
}): DayCloseSummary {
  const active = input.sales.filter((sale) => !sale.voidedAt);
  const totalMinor = active.reduce((sum, sale) => sum + sale.payment.amountMinor, 0);
  const qrisSales: DayCloseQrisSale[] = [];
  for (const sale of active) {
    const amountMinor = qrisTenderTotal({
      method: sale.payment.method,
      amount_minor: sale.payment.amountMinor,
      tenders: sale.payment.tenders.map((t) => ({ method: t.method, amount_minor: t.amountMinor })),
    });
    if (amountMinor > 0) qrisSales.push({ saleId: sale.saleId, completedAt: sale.completedAt, amountMinor });
  }
  const closedShifts: DayCloseShiftCash[] = input.closedShifts.map((row) => ({
    shiftId: row.shiftId,
    closedAt: row.closedAt ?? "",
    expectedCashMinor: row.expectedCashMinor ?? 0,
    countedCashMinor: row.countedCashMinor ?? 0,
    differenceMinor: row.differenceMinor ?? 0,
  }));
  const cash = dayCloseCashFromShifts(
    closedShifts.map((row) => ({
      expected_cash_minor: row.expectedCashMinor,
      counted_cash_minor: row.countedCashMinor,
      difference_minor: row.differenceMinor,
    })),
  );
  // Device-wide on purpose: a sale from an earlier shift that has not synced yet must still block / be acknowledged.
  const pendingSyncSaleIds = [...input.unsyncedSaleIds];
  return {
    sales: input.sales,
    totalMinor,
    transactionCount: active.length,
    pendingSyncSaleIds,
    pendingSyncCount: pendingSyncSaleIds.length,
    openShift: input.openShift,
    closedShifts,
    shiftExpectedTotalMinor: cash.expected_cash_minor,
    shiftCountedTotalMinor: cash.counted_cash_minor,
    shiftDifferenceTotalMinor: cash.difference_minor,
    qrisTotalMinor: qrisSales.reduce((sum, row) => sum + row.amountMinor, 0),
    qrisTransactionCount: qrisSales.length,
    qrisSales,
  };
}

export function dayCloseGate(summary: DayCloseSummary, acknowledgedUnsynced: boolean) {
  return evaluateDayClose({
    shift_open: Boolean(summary.openShift),
    closed_shift_count: summary.closedShifts.length,
    complete_sale_count: summary.sales.length,
    pending_sync_count: summary.pendingSyncCount,
    acknowledged_unsynced: acknowledgedUnsynced,
  });
}
