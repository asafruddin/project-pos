import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjustStock } from "./index";

describe("adjustStock", () => {
  it("accepts zero and positive integers", () => {
    assert.deepEqual(adjustStock(0), { ok: true, stock_qty: 0 });
    assert.deepEqual(adjustStock(12), { ok: true, stock_qty: 12 });
  });

  it("rejects negative and non-integer qty", () => {
    assert.equal(adjustStock(-1).ok, false);
    assert.equal(adjustStock(1.5).ok, false);
    const err = adjustStock(-3);
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "CATALOG_INVALID_STOCK");
    }
  });
});
