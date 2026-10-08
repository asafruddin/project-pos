import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupCatalogVariants,
  isSellableCatalogRow,
  tracksCatalogStock,
  variantDisplayLabel,
} from "./catalog";
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

describe("tracksCatalogStock", () => {
  it("treats missing trackStock as tracked and false as unlimited", () => {
    assert.equal(tracksCatalogStock(undefined), true);
    assert.equal(tracksCatalogStock(row({ productId: "s", name: "Latte" })), true);
    assert.equal(
      tracksCatalogStock(row({ productId: "u", name: "Jasa", trackStock: false, stockQty: 0 })),
      false,
    );
  });
});

describe("groupCatalogVariants", () => {
  const parent = row({ productId: "p", name: "Latte", variantGroups: ["Size"] });
  const m = row({ productId: "m", name: "Latte M", parentId: "p", variantLabel: "M", priceMinor: 20000, stockQty: 3 });
  const l = row({ productId: "l", name: "Latte L", parentId: "p", variantLabel: "L", priceMinor: 25000, stockQty: 2 });
  const simple = row({ productId: "s", name: "Tea" });

  it("collapses variants under the parent with price range and summed stock", () => {
    const items = groupCatalogVariants([m, l, simple], [parent]);
    assert.equal(items.length, 2);
    const group = items.find((i) => i.kind === "group");
    assert.ok(group && group.kind === "group");
    assert.equal(group.minPriceMinor, 20000);
    assert.equal(group.maxPriceMinor, 25000);
    assert.equal(group.totalStockQty, 5);
    assert.deepEqual(group.variants.map((v) => v.productId), ["l", "m"]);
  });

  it("keeps variants flat when the parent is not listed, and reports unlimited stock", () => {
    assert.equal(groupCatalogVariants([m], []).every((i) => i.kind === "product"), true);
    const unlimited = { ...l, trackStock: false };
    const [g] = groupCatalogVariants([m, unlimited], [parent]);
    assert.ok(g.kind === "group");
    assert.equal(g.totalStockQty, null);
  });

  it("hides all variants when the parent is inactive", () => {
    const off = { ...parent, status: "inactive" as const };
    assert.deepEqual(groupCatalogVariants([m, l, simple], [off]).map((i) => i.kind), ["product"]);
  });

  it("derives a label from the name when variantLabel is missing", () => {
    const legacy = row({ productId: "x", name: "Latte / XL", parentId: "p" });
    assert.equal(variantDisplayLabel(legacy, parent), "XL");
    assert.equal(variantDisplayLabel(l, parent), "L");
  });
});
