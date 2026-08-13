import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSellableCatalogRow } from "./catalog";
import type { CatalogProductRecord } from "./db";

function row(
  overrides: Partial<CatalogProductRecord> & Pick<CatalogProductRecord, "productId" | "name">,
): CatalogProductRecord {
  return {
    priceMinor: 1000,
    stockQty: 1,
    status: "active",
    parentId: null,
    pulledAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("isSellableCatalogRow", () => {
  it("hides inactive and parents that have variants", () => {
    const parent = row({ productId: "p", name: "Shirt" });
    const variant = row({ productId: "v", name: "Shirt / M", parentId: "p" });
    const inactive = row({ productId: "x", name: "Old", status: "inactive" });
    const simple = row({ productId: "s", name: "Latte" });
    const all = [parent, variant, inactive, simple];
    assert.equal(isSellableCatalogRow(parent, all), false);
    assert.equal(isSellableCatalogRow(variant, all), true);
    assert.equal(isSellableCatalogRow(inactive, all), false);
    assert.equal(isSellableCatalogRow(simple, all), true);
  });
});
