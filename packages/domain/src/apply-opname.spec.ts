import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOpname } from "./index";

describe("applyOpname", () => {
  it("computes counted minus current per line", () => {
    assert.deepEqual(
      applyOpname({
        lines: [
          { product_id: "p1", counted_qty: 8, current_qty: 10 },
          { product_id: "p2", counted_qty: 0, current_qty: -1 },
        ],
      }),
      {
        ok: true,
        adjustments: [
          {
            product_id: "p1",
            counted_qty: 8,
            current_qty: 10,
            qty_delta: -2,
          },
          {
            product_id: "p2",
            counted_qty: 0,
            current_qty: -1,
            qty_delta: 1,
          },
        ],
      },
    );
  });

  it("rejects empty, duplicate, and negative counted qty", () => {
    assert.equal(applyOpname({ lines: [] }).ok, false);
    assert.equal(
      applyOpname({
        lines: [
          { product_id: "p1", counted_qty: 1, current_qty: 1 },
          { product_id: "p1", counted_qty: 2, current_qty: 1 },
        ],
      }).ok,
      false,
    );
    const err = applyOpname({
      lines: [{ product_id: "p1", counted_qty: -1, current_qty: 0 }],
    });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "OPNAME_INVALID");
    }
  });
});
