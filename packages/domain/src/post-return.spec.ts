import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { approveRefund, postReturn } from "./index";

const line = {
  product_id: "coffee",
  sold_qty: 3,
  already_returned_qty: 0,
  return_qty: 2,
  decision: "resellable",
};

describe("postReturn", () => {
  it("posts sellable IN for resellable and damaged IN for damaged; warranty has no movement", () => {
    const result = postReturn({
      sale_complete: true,
      already_voided: false,
      reason: "  salah pesan ",
      lines: [
        line,
        {
          product_id: "cup",
          sold_qty: 1,
          already_returned_qty: 0,
          return_qty: 1,
          decision: "damaged",
        },
        {
          product_id: "lid",
          sold_qty: 1,
          already_returned_qty: 0,
          return_qty: 1,
          decision: "warranty",
        },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.movements, [
      { product_id: "coffee", qty: 2, bucket: "sellable" },
      { product_id: "cup", qty: 1, bucket: "damaged" },
    ]);
    assert.equal(result.lines.length, 3);
  });

  it("rejects incomplete, voided, empty reason, over-qty, and bad decision", () => {
    assert.equal(
      postReturn({
        sale_complete: false,
        already_voided: false,
        reason: "salah",
        lines: [line],
      }).ok,
      false,
    );
    assert.equal(
      postReturn({
        sale_complete: true,
        already_voided: true,
        reason: "salah",
        lines: [line],
      }).ok,
      false,
    );
    assert.equal(
      postReturn({
        sale_complete: true,
        already_voided: false,
        reason: "  ",
        lines: [line],
      }).ok,
      false,
    );
    assert.equal(
      postReturn({
        sale_complete: true,
        already_voided: false,
        reason: "salah",
        lines: [{ ...line, return_qty: 4 }],
      }).ok,
      false,
    );
    assert.equal(
      postReturn({
        sale_complete: true,
        already_voided: false,
        reason: "salah",
        lines: [{ ...line, already_returned_qty: 2, return_qty: 2 }],
      }).ok,
      false,
    );
    assert.equal(
      postReturn({
        sale_complete: true,
        already_voided: false,
        reason: "salah",
        lines: [{ ...line, decision: "keep" }],
      }).ok,
      false,
    );
  });
});

describe("approveRefund", () => {
  it("accepts an open return when amount matches expected", () => {
    assert.deepEqual(
      approveRefund({
        return_status: "open",
        amount_minor: 50000,
        expected_minor: 50000,
      }),
      { ok: true, amount_minor: 50000 },
    );
    assert.equal(
      approveRefund({
        return_status: "open",
        amount_minor: 0,
        expected_minor: 0,
      }).ok,
      true,
    );
  });

  it("rejects already refunded and mismatched amounts", () => {
    assert.equal(
      approveRefund({
        return_status: "refunded",
        amount_minor: 1,
        expected_minor: 1,
      }).ok,
      false,
    );
    assert.equal(
      approveRefund({
        return_status: "open",
        amount_minor: 1,
        expected_minor: 2,
      }).ok,
      false,
    );
  });
});
