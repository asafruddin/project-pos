import type { CatalogProduct } from "@/features/catalog/domain/product";
import { groupVariants, variantDisplayLabel } from "@/features/catalog/domain/variants";

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  productId: "p", name: "Espresso", priceMinor: 15000, stockQty: 0, status: "active",
  parentId: null, sku: null, categoryName: null, unitName: null, unitConversion: null, trackStock: false, ...over,
});

const parent = product({ productId: "p" });
const hot = product({ productId: "h", name: "Espresso - Hot", parentId: "p", priceMinor: 8000 });
const ice = product({ productId: "i", name: "Espresso - Ice", parentId: "p", priceMinor: 10000 });
const tea = product({ productId: "t", name: "Tea" });

describe("groupVariants", () => {
  it("collapses variants into one card with a price range, keeping order", () => {
    const items = groupVariants([tea, ice, hot], [parent]);
    expect(items.map((i) => i.kind)).toEqual(["product", "group"]);
    const group = items[1];
    if (group.kind !== "group") throw new Error("expected group");
    expect(group.parent.productId).toBe("p");
    expect(group.variants.map((v) => v.productId)).toEqual(["h", "i"]);
    expect(group.minPriceMinor).toBe(8000);
    expect(group.maxPriceMinor).toBe(10000);
    expect(group.totalStockQty).toBeNull();
  });

  it("sums tracked stock and keeps unknown-parent variants flat", () => {
    const a = { ...hot, trackStock: true, stockQty: 3 };
    const b = { ...ice, trackStock: true, stockQty: 4 };
    const [g] = groupVariants([a, b], [parent]);
    expect(g.kind === "group" && g.totalStockQty).toBe(7);
    expect(groupVariants([a], []).map((i) => i.kind)).toEqual(["product"]);
  });

  it("hides variants of an inactive parent", () => {
    expect(groupVariants([hot, ice, tea], [{ ...parent, status: "inactive" }]).map((i) => i.kind)).toEqual(["product"]);
  });

  it("derives the label from the name", () => {
    expect(variantDisplayLabel(hot, parent)).toBe("Hot");
    expect(variantDisplayLabel(product({ name: "Espresso - Regular / Ice" }), parent)).toBe("Regular / Ice");
    expect(variantDisplayLabel(product({ name: "Other" }), parent)).toBe("Other");
  });
});
