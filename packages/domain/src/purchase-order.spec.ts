import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transitionPurchaseOrder, validatePurchaseOrderLines } from "./index";

describe("transitionPurchaseOrder", () => {
  it("allows draft → submitted → approved", () => {
    assert.deepEqual(transitionPurchaseOrder({ from: "draft", to: "submitted" }), {
      ok: true,
      status: "submitted",
    });
    assert.deepEqual(
      transitionPurchaseOrder({ from: "submitted", to: "approved" }),
      { ok: true, status: "approved" },
    );
  });

  it("rejects invalid skips such as draft → completed", () => {
    const err = transitionPurchaseOrder({ from: "draft", to: "completed" });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "PO_INVALID_TRANSITION");
    }
    assert.equal(
      transitionPurchaseOrder({ from: "approved", to: "draft" }).ok,
      false,
    );
  });

  it("allows cancelling draft or submitted only", () => {
    assert.equal(
      transitionPurchaseOrder({ from: "draft", to: "cancelled" }).ok,
      true,
    );
    assert.equal(
      transitionPurchaseOrder({ from: "submitted", to: "cancelled" }).ok,
      true,
    );
    assert.equal(
      transitionPurchaseOrder({ from: "approved", to: "cancelled" }).ok,
      false,
    );
  });
});

describe("validatePurchaseOrderLines", () => {
  it("accepts unique lines with qty ≥ 1 and non-negative cost", () => {
    assert.deepEqual(
      validatePurchaseOrderLines([
        { product_id: "p1", qty: 2, cost_minor: 15000 },
      ]),
      {
        ok: true,
        lines: [{ product_id: "p1", qty: 2, cost_minor: 15000 }],
      },
    );
  });

  it("rejects empty, duplicate, and invalid qty/cost", () => {
    assert.equal(validatePurchaseOrderLines([]).ok, false);
    assert.equal(
      validatePurchaseOrderLines([
        { product_id: "p1", qty: 1, cost_minor: 1 },
        { product_id: "p1", qty: 2, cost_minor: 1 },
      ]).ok,
      false,
    );
    assert.equal(
      validatePurchaseOrderLines([{ product_id: "p1", qty: 0, cost_minor: 1 }])
        .ok,
      false,
    );
    const err = validatePurchaseOrderLines([
      { product_id: "p1", qty: 1, cost_minor: -1 },
    ]);
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "PO_INVALID_LINE");
    }
  });
});
