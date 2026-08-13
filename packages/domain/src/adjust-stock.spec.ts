import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjustStock } from "./index";

describe("adjustStock", () => {
  it("accepts zero and positive integer targets with a reason", () => {
    assert.deepEqual(
      adjustStock({ currentQty: 0, targetQty: 0, reason: "initial_stock" }),
      { ok: true, stock_qty: 0, qty_delta: 0, reason: "initial_stock" },
    );
    assert.deepEqual(
      adjustStock({ currentQty: 4, targetQty: 12, reason: "koreksi" }),
      { ok: true, stock_qty: 12, qty_delta: 8, reason: "koreksi" },
    );
  });

  it("computes negative delta when lowering qty", () => {
    const result = adjustStock({
      currentQty: 10,
      targetQty: 3,
      reason: "koreksi hitung",
    });
    assert.deepEqual(result, {
      ok: true,
      stock_qty: 3,
      qty_delta: -7,
      reason: "koreksi hitung",
    });
  });

  it("rejects empty reason", () => {
    const err = adjustStock({ currentQty: 1, targetQty: 2, reason: "   " });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "CATALOG_STOCK_REASON_REQUIRED");
    }
  });

  it("rejects negative and non-integer target qty", () => {
    assert.equal(
      adjustStock({ currentQty: 1, targetQty: -1, reason: "koreksi" }).ok,
      false,
    );
    assert.equal(
      adjustStock({ currentQty: 1, targetQty: 1.5, reason: "koreksi" }).ok,
      false,
    );
    const err = adjustStock({ currentQty: 5, targetQty: -3, reason: "koreksi" });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "CATALOG_INVALID_STOCK");
    }
  });

  it("allows raising from a negative current projection", () => {
    const result = adjustStock({
      currentQty: -2,
      targetQty: 0,
      reason: "koreksi setelah oversell",
    });
    assert.deepEqual(result, {
      ok: true,
      stock_qty: 0,
      qty_delta: 2,
      reason: "koreksi setelah oversell",
    });
  });
});
