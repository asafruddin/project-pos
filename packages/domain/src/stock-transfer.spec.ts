import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  receiveTransfer,
  shipTransfer,
  transitionStockTransfer,
  validateTransferLines,
} from "./index";

const from_store = "store-a";
const to_store = "store-b";
const lines = [{ product_id: "coffee", qty: 4 }];

describe("transitionStockTransfer", () => {
  it("allows draft → requested → approved", () => {
    assert.deepEqual(
      transitionStockTransfer({ from: "draft", to: "requested" }),
      { ok: true, status: "requested" },
    );
    assert.deepEqual(
      transitionStockTransfer({ from: "requested", to: "approved" }),
      { ok: true, status: "approved" },
    );
  });

  it("rejects invalid skips such as draft → shipped", () => {
    const result = transitionStockTransfer({ from: "draft", to: "shipped" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "TRANSFER_INVALID_STATUS");
    assert.equal(
      transitionStockTransfer({ from: "shipped", to: "completed" }).ok,
      false,
    );
  });

  it("allows cancelling draft or requested only", () => {
    assert.equal(
      transitionStockTransfer({ from: "draft", to: "cancelled" }).ok,
      true,
    );
    assert.equal(
      transitionStockTransfer({ from: "shipped", to: "cancelled" }).ok,
      false,
    );
  });
});

describe("validateTransferLines", () => {
  it("accepts unique lines with qty ≥ 1", () => {
    assert.equal(validateTransferLines(lines).ok, true);
  });

  it("rejects empty, duplicate, and invalid qty", () => {
    assert.equal(validateTransferLines([]).ok, false);
    assert.equal(
      validateTransferLines([
        { product_id: "coffee", qty: 1 },
        { product_id: "coffee", qty: 2 },
      ]).ok,
      false,
    );
    assert.equal(
      validateTransferLines([{ product_id: "coffee", qty: 0 }]).ok,
      false,
    );
  });
});

describe("shipTransfer / receiveTransfer", () => {
  it("ships sellable OUT at A and in-transit IN at B", () => {
    const result = shipTransfer({
      from_store_id: from_store,
      to_store_id: to_store,
      lines,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.movements, [
        {
          store_id: from_store,
          product_id: "coffee",
          qty_delta: -4,
          bucket: "sellable",
          reason: "transfer_ship",
        },
        {
          store_id: to_store,
          product_id: "coffee",
          qty_delta: 4,
          bucket: "in_transit",
          reason: "transfer_ship",
        },
      ]);
    }
  });

  it("receives in-transit OUT and sellable IN at B", () => {
    const result = receiveTransfer({
      from_store_id: from_store,
      to_store_id: to_store,
      lines,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.movements, [
        {
          store_id: to_store,
          product_id: "coffee",
          qty_delta: -4,
          bucket: "in_transit",
          reason: "transfer_receive",
        },
        {
          store_id: to_store,
          product_id: "coffee",
          qty_delta: 4,
          bucket: "sellable",
          reason: "transfer_receive",
        },
      ]);
    }
  });

  it("rejects same-store and empty lines", () => {
    assert.equal(
      shipTransfer({
        from_store_id: from_store,
        to_store_id: from_store,
        lines,
      }).ok,
      false,
    );
    assert.equal(
      receiveTransfer({
        from_store_id: from_store,
        to_store_id: to_store,
        lines: [],
      }).ok,
      false,
    );
  });
});
