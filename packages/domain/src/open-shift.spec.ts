import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openShift, requireSaleShift } from "./index";

describe("openShift", () => {
  it("records non-negative integer opening cash", () => {
    assert.deepEqual(openShift({ opening_cash_minor: 0, already_open: false }), {
      ok: true,
      opening_cash_minor: 0,
    });
    assert.deepEqual(
      openShift({ opening_cash_minor: 150000, already_open: false }),
      { ok: true, opening_cash_minor: 150000 },
    );
  });

  it("rejects a second open while one is already open", () => {
    const err = openShift({ opening_cash_minor: 1, already_open: true });
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "SHIFT_ALREADY_OPEN");
  });

  it("rejects negative and non-integer opening cash", () => {
    const neg = openShift({ opening_cash_minor: -1, already_open: false });
    assert.equal(neg.ok, false);
    if (!neg.ok) assert.equal(neg.code, "SHIFT_INVALID_OPENING");
    assert.equal(
      openShift({ opening_cash_minor: 1.5, already_open: false }).ok,
      false,
    );
  });
});

describe("requireSaleShift", () => {
  it("accepts a non-empty shift_id", () => {
    assert.deepEqual(requireSaleShift("shift-1"), {
      ok: true,
      shift_id: "shift-1",
    });
  });

  it("rejects missing shift_id (AD-16)", () => {
    const err = requireSaleShift(null);
    assert.equal(err.ok, false);
    if (!err.ok) assert.equal(err.code, "SALE_SHIFT_REQUIRED");
    assert.equal(requireSaleShift("").ok, false);
    assert.equal(requireSaleShift(undefined).ok, false);
  });
});
