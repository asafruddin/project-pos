import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildShiftReport, type ShiftReportInput } from "./index";

const cash = (amount_minor: number) => ({ method: "cash" as const, amount_minor });

const base: ShiftReportInput = {
  storeName: "Warung A",
  shift: {
    openedAt: "2026-10-08T01:00:00.000Z",
    closedAt: null,
    openingCashMinor: 100_000,
    expectedCashMinor: null,
  },
  movements: [
    { kind: "out", amountMinor: 20_000, reason: "Beli es batu", occurredAt: "2026-10-08T03:00:00.000Z" },
    { kind: "out", amountMinor: 5_000, reason: "Parkir", occurredAt: "2026-10-08T02:00:00.000Z" },
  ],
  sales: [
    { saleId: "b", completedAt: "2026-10-08T02:30:00.000Z", queueNumber: 2, voided: false, amountMinor: 30_000,
      payment: { method: "qris", amount_minor: 30_000 } },
    { saleId: "a", completedAt: "2026-10-08T02:00:00.000Z", queueNumber: 1, guestName: " Sari ", voided: false,
      amountMinor: 50_000, payment: cash(50_000) },
    { saleId: "c", completedAt: "2026-10-08T04:00:00.000Z", queueNumber: 3, voided: true, amountMinor: 10_000,
      payment: cash(10_000) },
  ],
  cashRefundsMinor: 0,
  refundsKnown: true,
};

describe("buildShiftReport", () => {
  it("final cash = opening + cash sales − cash out − voids, so cash out is included", () => {
    const report = buildShiftReport(base);
    assert.equal(report.recap.cashSalesMinor, 60_000);
    assert.equal(report.recap.cashOutMinor, 25_000);
    assert.equal(report.recap.cashVoidsMinor, 10_000);
    assert.equal(report.recap.finalCashMinor, 100_000 + 60_000 - 25_000 - 10_000);
  });

  it("grand total = opening + all non-voided sales (any method) − cash out − refunds", () => {
    const report = buildShiftReport({ ...base, cashRefundsMinor: 5_000 });
    assert.equal(report.recap.grandTotalMinor, 100_000 + 80_000 - 25_000 - 5_000);
  });

  it("splits totals by method, skips voided sales, and lists sales in time order", () => {
    const report = buildShiftReport(base);
    assert.deepEqual(report.totals, {
      salesCount: 2, voidedCount: 1, cashMinor: 50_000, qrisMinor: 30_000, storeCreditMinor: 0, totalMinor: 80_000,
    });
    assert.deepEqual(report.sales.map((s) => s.saleId), ["a", "b", "c"]);
    assert.equal(report.sales[0].guestName, "Sari");
  });

  it("lists cash-outs oldest first and keeps the stored expected cash of a closed shift", () => {
    const report = buildShiftReport({
      ...base,
      shift: { ...base.shift, closedAt: "2026-10-08T09:00:00.000Z", expectedCashMinor: 123_000 },
    });
    assert.deepEqual(report.cashOuts.map((c) => c.reason), ["Parkir", "Beli es batu"]);
    assert.equal(report.recap.finalCashMinor, 123_000);
  });

  it("subtracts known cash refunds", () => {
    const report = buildShiftReport({ ...base, cashRefundsMinor: 5_000 });
    assert.equal(report.recap.finalCashMinor, 100_000 + 60_000 - 25_000 - 5_000 - 10_000);
  });
});
