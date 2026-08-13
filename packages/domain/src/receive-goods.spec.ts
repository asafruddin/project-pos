import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receiveGoods } from "./index";

describe("receiveGoods", () => {
  const po_lines = [
    { product_id: "p1", ordered_qty: 10, received_qty: 0 },
    { product_id: "p2", ordered_qty: 4, received_qty: 0 },
  ];

  it("partial receive leaves remaining open", () => {
    const result = receiveGoods({
      po_status: "approved",
      po_lines,
      receive: [{ product_id: "p1", qty: 3 }],
    });
    assert.deepEqual(result, {
      ok: true,
      receipts: [{ product_id: "p1", qty: 3, received_qty: 3 }],
      status: "partially_received",
    });
  });

  it("full receive of all lines completes the PO", () => {
    const result = receiveGoods({
      po_status: "partially_received",
      po_lines: [
        { product_id: "p1", ordered_qty: 10, received_qty: 3 },
        { product_id: "p2", ordered_qty: 4, received_qty: 0 },
      ],
      receive: [
        { product_id: "p1", qty: 7 },
        { product_id: "p2", qty: 4 },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.status, "completed");
    }
  });

  it("rejects unapproved PO, over-receive, and empty receive", () => {
    assert.equal(
      receiveGoods({
        po_status: "draft",
        po_lines,
        receive: [{ product_id: "p1", qty: 1 }],
      }).ok,
      false,
    );
    const over = receiveGoods({
      po_status: "approved",
      po_lines,
      receive: [{ product_id: "p1", qty: 11 }],
    });
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.code, "GR_INVALID");
    }
    assert.equal(
      receiveGoods({ po_status: "approved", po_lines, receive: [] }).ok,
      false,
    );
  });
});
