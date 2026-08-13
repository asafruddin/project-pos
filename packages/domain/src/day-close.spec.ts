import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayCloseCashFromShifts, evaluateDayClose } from "./index";

describe("evaluateDayClose", () => {
  const base = {
    shift_open: false,
    closed_shift_count: 1,
    complete_sale_count: 2,
    pending_sync_count: 0,
    acknowledged_unsynced: false,
  };

  it("allows finish when the shift is closed, sales exist, and sync is drained", () => {
    assert.deepEqual(evaluateDayClose(base), { ok: true });
  });

  it("blocks finish while a shift is open (FR-111)", () => {
    const err = evaluateDayClose({ ...base, shift_open: true });
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "DAY_CLOSE_SHIFT_OPEN");
  });

  it("blocks finish when complete sales exist but no shift closed today", () => {
    const err = evaluateDayClose({
      ...base,
      closed_shift_count: 0,
      complete_sale_count: 1,
    });
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "DAY_CLOSE_SHIFT_REQUIRED");
  });

  it("allows an empty day with no sales and no closed shifts", () => {
    assert.deepEqual(
      evaluateDayClose({
        ...base,
        closed_shift_count: 0,
        complete_sale_count: 0,
      }),
      { ok: true },
    );
  });

  it("blocks finish while unsynced sales remain unless acknowledged (FR-24)", () => {
    const blocked = evaluateDayClose({ ...base, pending_sync_count: 3 });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, "DAY_CLOSE_SYNC_PENDING");
    assert.deepEqual(
      evaluateDayClose({
        ...base,
        pending_sync_count: 3,
        acknowledged_unsynced: true,
      }),
      { ok: true },
    );
  });

  it("does not let acknowledge bypass an open shift", () => {
    const err = evaluateDayClose({
      ...base,
      shift_open: true,
      pending_sync_count: 1,
      acknowledged_unsynced: true,
    });
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "DAY_CLOSE_SHIFT_OPEN");
  });
});

describe("dayCloseCashFromShifts", () => {
  it("sums closed shift snapshots without recomputing FR-78", () => {
    assert.deepEqual(
      dayCloseCashFromShifts([
        {
          expected_cash_minor: 100000,
          counted_cash_minor: 90000,
          difference_minor: -10000,
        },
        {
          expected_cash_minor: 50000,
          counted_cash_minor: 50000,
          difference_minor: 0,
        },
      ]),
      {
        expected_cash_minor: 150000,
        counted_cash_minor: 140000,
        difference_minor: -10000,
      },
    );
  });
});
