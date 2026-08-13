import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LocalSaleRecord } from "./db";
import { evaluateVoid, restoreCatalogQty } from "./void-sale";

function sale(
  overrides: Partial<LocalSaleRecord> = {},
): LocalSaleRecord {
  const now = new Date();
  return {
    saleId: "s1",
    deviceId: "d1",
    createdAt: now.toISOString(),
    completedAt: now.toISOString(),
    status: "complete",
    payment: { method: "cash", amountMinor: 50000 },
    lines: [{ productId: "p1", name: "Latte", priceMinor: 25000, qty: 2 }],
    ...overrides,
  };
}

describe("evaluateVoid", () => {
  it("allows a complete same-day sale", () => {
    const result = evaluateVoid(sale());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.lines, [{ product_id: "p1", qty: 2 }]);
  });

  it("rejects incomplete cancel, already voided, and other calendar days", () => {
    assert.equal(evaluateVoid(sale({ status: "incomplete", completedAt: undefined })).ok, false);
    assert.equal(evaluateVoid(sale({ voidedAt: new Date().toISOString() })).ok, false);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(
      evaluateVoid(sale({ completedAt: yesterday.toISOString() })).ok,
      false,
    );
  });
});

describe("restoreCatalogQty", () => {
  it("increments local sellable projection and skips missing products", () => {
    const next = restoreCatalogQty(
      [
        { productId: "p1", name: "Latte", priceMinor: 25000, qty: 2 },
        { productId: "gone", name: "Old", priceMinor: 1, qty: 1 },
      ],
      (id) => (id === "p1" ? 3 : undefined),
    );
    assert.equal(next.get("p1"), 5);
    assert.equal(next.has("gone"), false);
  });
});
