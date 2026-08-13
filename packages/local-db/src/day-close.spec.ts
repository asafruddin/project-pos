import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { endOfLocalDay, startOfLocalDay } from "./sales.js";
import {
  closedShiftsForLocalDay,
  dayCloseGate,
  dayCloseSummaryFrom,
} from "./day-close.js";
import type { LocalSaleRecord, LocalShiftRecord } from "./db.js";

describe("day-close day bounds", () => {
  it("startOfLocalDay is midnight local and end is next midnight", () => {
    const d = new Date(2026, 7, 7, 15, 30, 0);
    const start = startOfLocalDay(d);
    const end = endOfLocalDay(d);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
    assert.equal(start.getDate(), 7);
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  });
});

const closedToday: LocalShiftRecord = {
  shiftId: "sh-1",
  storeId: "s",
  registerId: "r",
  openedAt: "2026-08-13T07:00:00.000Z",
  openingCashMinor: 100000,
  status: "closed",
  closedAt: new Date(2026, 7, 13, 16, 0, 0).toISOString(),
  expectedCashMinor: 145000,
  countedCashMinor: 140000,
  differenceMinor: -5000,
};

describe("closedShiftsForLocalDay", () => {
  it("includes shifts closed today, not still-open or closed yesterday", () => {
    const day = new Date(2026, 7, 13, 20, 0, 0);
    const open: LocalShiftRecord = { ...closedToday, shiftId: "open", status: "open", closedAt: undefined };
    const yesterday: LocalShiftRecord = {
      ...closedToday,
      shiftId: "old",
      closedAt: new Date(2026, 7, 12, 16, 0, 0).toISOString(),
    };
    const rows = closedShiftsForLocalDay([closedToday, open, yesterday], day);
    assert.deepEqual(rows.map((r) => r.shiftId), ["sh-1"]);
  });
});

describe("dayCloseSummaryFrom", () => {
  it("sales total stays sale-based; cash is closed shift snapshots", () => {
    const sale: LocalSaleRecord = {
      saleId: "sale-1",
      deviceId: "d",
      createdAt: "2026-08-13T08:00:00.000Z",
      completedAt: "2026-08-13T08:00:00.000Z",
      status: "complete",
      payment: { method: "cash", amountMinor: 25000 },
      lines: [],
      shiftId: "sh-1",
    };
    const summary = dayCloseSummaryFrom({
      sales: [sale],
      pendingSyncSaleIds: [sale.saleId],
      openShift: null,
      closedShifts: [closedToday],
    });
    assert.equal(summary.totalMinor, 25000);
    assert.equal(summary.shiftExpectedTotalMinor, 145000);
    assert.equal(summary.shiftCountedTotalMinor, 140000);
    assert.equal(summary.shiftDifferenceTotalMinor, -5000);
    assert.equal(summary.pendingSyncCount, 1);
    assert.notEqual(summary.totalMinor, summary.shiftExpectedTotalMinor);
  });
});

describe("dayCloseGate", () => {
  it("blocks an open shift even if unsynced sales are acknowledged", () => {
    const summary = dayCloseSummaryFrom({
      sales: [],
      pendingSyncSaleIds: ["x"],
      openShift: {
        shiftId: "open",
        storeId: "s",
        registerId: "r",
        openedAt: "2026-08-13T07:00:00.000Z",
        openingCashMinor: 0,
        status: "open",
      },
      closedShifts: [],
    });
    const err = dayCloseGate(summary, true);
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "DAY_CLOSE_SHIFT_OPEN");
  });
});

describe("day-close isolation (AD-8)", () => {
  it("does not drain sync outbox, write ledger, or import Cloudinary", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "day-close.ts"),
      "utf8",
    );
    assert.equal(/delete\(["']syncOutbox|insertStockMovement|cloudinary/.test(src), false);
  });
});

