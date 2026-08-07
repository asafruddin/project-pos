import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptCompleteSale } from "./index";

describe("acceptCompleteSale", () => {
  it("decrements each product by its combined quantity", () => {
    const result = acceptCompleteSale(
      [{ product_id: "coffee", stock_qty: 5 }],
      [
        { product_id: "coffee", qty: 2 },
        { product_id: "coffee", qty: 1 },
      ],
    );

    assert.deepEqual(result, {
      ok: true,
      products: [{ product_id: "coffee", stock_qty: 2 }],
    });
  });

  it("fails closed for invalid quantities and insufficient stock", () => {
    assert.equal(
      acceptCompleteSale([{ product_id: "coffee", stock_qty: 1 }], [
        { product_id: "coffee", qty: 2 },
      ]).ok,
      false,
    );
    assert.equal(
      acceptCompleteSale([{ product_id: "coffee", stock_qty: 1 }], [
        { product_id: "coffee", qty: 0 },
      ]).ok,
      false,
    );
  });
});
