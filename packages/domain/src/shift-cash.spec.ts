import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeShift, expectedCash, recordCashMovement } from "./index";

describe("recordCashMovement", () => {
  it("accepts in/out with a reason on an open shift", () => {
    assert.deepEqual(
      recordCashMovement({
        kind: "in",
        amount_minor: 50000,
        reason: " isi laci ",
        shift_open: true,
      }),
      { ok: true, kind: "in", amount_minor: 50000, reason: "isi laci" },
    );
  });

  it("requires an open shift, reason, and amount ≥ 1", () => {
    assert.equal(
      recordCashMovement({
        kind: "out",
        amount_minor: 1,
        reason: "tip",
        shift_open: false,
      }).ok,
      false,
    );
    const noReason = recordCashMovement({
      kind: "out",
      amount_minor: 1,
      reason: "  ",
      shift_open: true,
    });
    assert.equal(noReason.ok, false);
    if (!noReason.ok) assert.equal(noReason.code, "SHIFT_CASH_REASON_REQUIRED");
    assert.equal(
      recordCashMovement({
        kind: "out",
        amount_minor: 0,
        reason: "tip",
        shift_open: true,
      }).ok,
      false,
    );
  });
});

describe("expectedCash", () => {
  it("opening + sales + in − out − refunds − voids", () => {
    const result = expectedCash({
      opening_cash_minor: 100000,
      cash_sales_minor: 50000,
      cash_in_minor: 10000,
      cash_out_minor: 5000,
      cash_refunds_minor: 2000,
      cash_voids_minor: 8000,
    });
    assert.deepEqual(result, { ok: true, expected_cash_minor: 145000 });
  });

  it("a voided cash sale nets to zero (sales include it, voids subtract it)", () => {
    const result = expectedCash({
      opening_cash_minor: 0,
      cash_sales_minor: 25000,
      cash_in_minor: 0,
      cash_out_minor: 0,
      cash_refunds_minor: 0,
      cash_voids_minor: 25000,
    });
    assert.deepEqual(result, { ok: true, expected_cash_minor: 0 });
  });
});

describe("closeShift", () => {
  it("records a non-zero difference without blocking", () => {
    const result = closeShift({
      status: "open",
      counted_cash_minor: 90000,
      expected_cash_minor: 100000,
    });
    assert.deepEqual(result, {
      ok: true,
      counted_cash_minor: 90000,
      expected_cash_minor: 100000,
      difference_minor: -10000,
      warned: true,
    });
  });

  it("does not warn when counted matches expected", () => {
    const result = closeShift({
      status: "open",
      counted_cash_minor: 10,
      expected_cash_minor: 10,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.warned, false);
  });

  it("rejects closing a shift that is not open", () => {
    const err = closeShift({
      status: "closed",
      counted_cash_minor: 0,
      expected_cash_minor: 0,
    });
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "SHIFT_NOT_OPEN");
  });
});
