import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markDamaged } from "./index";

describe("markDamaged", () => {
  it("accepts a positive integer qty with a reason", () => {
    assert.deepEqual(markDamaged({ qty: 2, reason: " pecah " }), {
      ok: true,
      qty: 2,
      reason: "pecah",
    });
  });

  it("rejects empty reason and non-positive qty", () => {
    assert.equal(markDamaged({ qty: 1, reason: "   " }).ok, false);
    assert.equal(markDamaged({ qty: 0, reason: "pecah" }).ok, false);
    assert.equal(markDamaged({ qty: 1.5, reason: "pecah" }).ok, false);
    const err = markDamaged({ qty: -1, reason: "pecah" });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "STOCK_INVALID_MOVEMENT");
    }
  });
});
