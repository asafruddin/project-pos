import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postStockMovement } from "./index";

describe("postStockMovement", () => {
  it("accepts a signed integer delta with reason and bucket", () => {
    assert.deepEqual(
      postStockMovement({
        qty_delta: -3,
        bucket: "sellable",
        reason: "sale",
      }),
      { ok: true, qty_delta: -3, bucket: "sellable", reason: "sale" },
    );
  });

  it("rejects empty reason, non-integer delta, and unknown bucket", () => {
    assert.equal(
      postStockMovement({ qty_delta: 1, bucket: "sellable", reason: " " }).ok,
      false,
    );
    assert.equal(
      postStockMovement({
        qty_delta: 1.2,
        bucket: "sellable",
        reason: "koreksi",
      }).ok,
      false,
    );
    const err = postStockMovement({
      qty_delta: 1,
      bucket: "reserved",
      reason: "koreksi",
    });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "STOCK_INVALID_MOVEMENT");
    }
  });
});
