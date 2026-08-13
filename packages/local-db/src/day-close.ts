import { dayCloseCashFromShifts, evaluateDayClose } from "@pos-apps/domain";
import {
  openLocalDb,
  type LocalSaleRecord,
  type LocalShiftRecord,
} from "./db.js";
import { endOfLocalDay, startOfLocalDay } from "./day-bounds.js";
import { listCompleteSalesForLocalDay, listPendingSyncSales, listPendingSyncVoids } from "./sales.js";
import { getOpenShiftFrom } from "./shifts.js";

export type DayCloseShiftCash = {
  shiftId: string;
  closedAt: string;
  expectedCashMinor: number;
  countedCashMinor: number;
  differenceMinor: number;
};

export type DayCloseSummary = {
  sales: LocalSaleRecord[];
  totalMinor: number;
  transactionCount: number;
  pendingSyncSaleIds: string[];
  pendingSyncCount: number;
  openShift: LocalShiftRecord | null;
  closedShifts: DayCloseShiftCash[];
  shiftExpectedTotalMinor: number;
  shiftCountedTotalMinor: number;
  shiftDifferenceTotalMinor: number;
};

export function closedShiftsForLocalDay(
  rows: LocalShiftRecord[],
  day: Date = new Date(),
): LocalShiftRecord[] {
  const start = startOfLocalDay(day).getTime();
  const end = endOfLocalDay(day).getTime();
  return rows.filter((row) => {
    if (row.status !== "closed" || !row.closedAt) return false;
    const t = Date.parse(row.closedAt);
    return Number.isFinite(t) && t >= start && t < end;
  });
}

function toShiftCash(row: LocalShiftRecord): DayCloseShiftCash {
  return {
    shiftId: row.shiftId,
    closedAt: row.closedAt ?? "",
    expectedCashMinor: row.expectedCashMinor ?? 0,
    countedCashMinor: row.countedCashMinor ?? 0,
    differenceMinor: row.differenceMinor ?? 0,
  };
}

export function dayCloseSummaryFrom(input: {
  sales: LocalSaleRecord[];
  pendingSyncSaleIds: string[];
  openShift: LocalShiftRecord | null;
  closedShifts: LocalShiftRecord[];
}): DayCloseSummary {
  const active = input.sales.filter((sale) => !sale.voidedAt);
  const totalMinor = active.reduce(
    (sum, sale) => sum + (sale.payment?.amountMinor ?? 0),
    0,
  );
  const closedShifts = input.closedShifts.map(toShiftCash);
  const cash = dayCloseCashFromShifts(
    closedShifts.map((row) => ({
      expected_cash_minor: row.expectedCashMinor,
      counted_cash_minor: row.countedCashMinor,
      difference_minor: row.differenceMinor,
    })),
  );
  return {
    sales: input.sales,
    totalMinor,
    transactionCount: active.length,
    pendingSyncSaleIds: input.pendingSyncSaleIds,
    pendingSyncCount: input.pendingSyncSaleIds.length,
    openShift: input.openShift,
    closedShifts,
    shiftExpectedTotalMinor: cash.expected_cash_minor,
    shiftCountedTotalMinor: cash.counted_cash_minor,
    shiftDifferenceTotalMinor: cash.difference_minor,
  };
}

export function dayCloseGate(
  summary: DayCloseSummary,
  acknowledgedUnsynced: boolean,
) {
  return evaluateDayClose({
    shift_open: Boolean(summary.openShift),
    closed_shift_count: summary.closedShifts.length,
    complete_sale_count: summary.sales.length,
    pending_sync_count: summary.pendingSyncCount,
    acknowledged_unsynced: acknowledgedUnsynced,
  });
}

export async function getDayCloseSummary(
  day: Date = new Date(),
): Promise<DayCloseSummary> {
  const db = await openLocalDb();
  const [sales, pendingSales, pendingVoids, shiftRows] = await Promise.all([
    listCompleteSalesForLocalDay(day),
    listPendingSyncSales(),
    listPendingSyncVoids(),
    db.getAll("shifts"),
  ]);
  const pendingIds = new Set(pendingSales.map((s) => s.saleId));
  for (const item of pendingVoids) pendingIds.add(item.saleId);
  const pendingSyncSaleIds = sales
    .filter((s) => pendingIds.has(s.saleId))
    .map((s) => s.saleId);
  return dayCloseSummaryFrom({
    sales,
    pendingSyncSaleIds,
    openShift: getOpenShiftFrom(shiftRows),
    closedShifts: closedShiftsForLocalDay(shiftRows, day),
  });
}
