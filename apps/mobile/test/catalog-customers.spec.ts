import { addProduct, emptyCart } from "@/features/cart/domain/cart";
import { buildParkedCart } from "@/features/cart/domain/parked-cart";
import { DrizzleParkedCartRepository } from "@/features/cart/data/drizzle-parked-cart-repository";
import {
  activeFilterCount,
  categoriesOf,
  defaultFilters,
  filterAndSort,
  paginate,
} from "@/features/catalog/domain/catalog-view";
import { canOfferUnpack, isValidSellablePrice, withLivePackStock } from "@/features/catalog/domain/product";
import { matchCustomers } from "@/features/customers/domain/customer";
import { createHarness, drainOutbox, product } from "./helpers/harness";

describe("catalog view", () => {
  const items = [
    product({ productId: "a", name: "Kopi Susu", priceMinor: 18000, stockQty: 5, categoryName: "Kopi", sku: "KS" }),
    product({ productId: "b", name: "Air Mineral", priceMinor: 5000, stockQty: 0, categoryName: "Minuman" }),
    product({ productId: "c", name: "teh manis", priceMinor: 8000, stockQty: 12, categoryName: "Minuman", unitName: "gelas" }),
    product({ productId: "d", name: "Jasa Antar", priceMinor: 3000, stockQty: 0, trackStock: false }),
  ];
  const f = defaultFilters("id");

  it("searches name, SKU and unit case-insensitively", () => {
    expect(filterAndSort(items, { ...f, query: "kopi" }).map((p) => p.productId)).toEqual(["a"]);
    expect(filterAndSort(items, { ...f, query: "ks" }).map((p) => p.productId)).toEqual(["a"]);
    expect(filterAndSort(items, { ...f, query: "GELAS" }).map((p) => p.productId)).toEqual(["c"]);
  });

  it("filters by category and stock (untracked products count as in stock, never as out)", () => {
    expect(filterAndSort(items, { ...f, category: "Minuman" }).map((p) => p.productId)).toEqual(["b", "c"]);
    expect(filterAndSort(items, { ...f, stock: "in" }).map((p) => p.productId)).toEqual(["d", "a", "c"]);
    expect(filterAndSort(items, { ...f, stock: "out" }).map((p) => p.productId)).toEqual(["b"]);
  });

  it("sorts by name, price and stock", () => {
    const ids = (sort: Parameters<typeof filterAndSort>[1]["sort"]) => filterAndSort(items, { ...f, sort }).map((p) => p.productId);
    expect(ids("name-asc")).toEqual(["b", "d", "a", "c"]);
    expect(ids("name-desc")).toEqual(["c", "a", "d", "b"]);
    expect(ids("price-asc")).toEqual(["d", "b", "c", "a"]);
    expect(ids("price-desc")).toEqual(["a", "c", "b", "d"]);
    expect(ids("stock-desc")[0]).toBe("c");
  });

  it("lists categories, counts active filters and paginates safely", () => {
    expect(categoriesOf(items, "id")).toEqual(["Kopi", "Minuman"]);
    expect(activeFilterCount({ category: "", stock: "all", sort: "name-asc" })).toBe(0);
    expect(activeFilterCount({ category: "Kopi", stock: "in", sort: "price-asc" })).toBe(3);
    const many = Array.from({ length: 50 }, (_, i) => i);
    expect(paginate(many, 1)).toMatchObject({ page: 1, totalPages: 3 });
    expect(paginate(many, 3).rows).toHaveLength(2);
    expect(paginate(many, 99).page).toBe(3);
    expect(paginate([], 5)).toMatchObject({ page: 1, totalPages: 1, rows: [] });
  });

  it("offers unpack only online, with pack stock, and keeps pack stock live", () => {
    const pack = product({ productId: "pack", name: "Pack", stockQty: 4 });
    const pcs = product({
      productId: "pcs",
      stockQty: 0,
      unitConversion: { fromProductId: "pack", fromProductName: "Pack", fromUnitName: "dus", fromStockQty: 1, fromQty: 1, toQty: 12 },
    });
    expect(canOfferUnpack(pcs, true, [pack, pcs])).toBe(true);
    expect(canOfferUnpack(pcs, false, [pack, pcs])).toBe(false);
    expect(canOfferUnpack(pcs, true, [{ ...pack, stockQty: 0 }, pcs])).toBe(false);
    expect(withLivePackStock([pack, pcs])[1].unitConversion?.fromStockQty).toBe(4);
    expect(isValidSellablePrice(0)).toBe(false);
    expect(isValidSellablePrice(1500)).toBe(true);
  });
});

describe("catalog repository", () => {
  it("replaces atomically, hides parents/inactive rows, round-trips unit conversion, patches stock", () => {
    const h = createHarness();
    const conv = { fromProductId: "x", fromProductName: "X", fromUnitName: null, fromStockQty: 2, fromQty: 1, toQty: 6 };
    h.catalog.replaceAll(
      [
        product({ productId: "parent", name: "Kopi (varian)" }),
        product({ productId: "c1", name: "Kopi Susu", parentId: "parent", unitConversion: conv }),
        product({ productId: "x", name: "Teh", status: "inactive" }),
        product({ productId: "a", name: "air mineral" }),
      ],
      "2025-01-01T00:00:00.000Z",
    );
    expect(h.catalog.listSellable().map((p) => p.productId)).toEqual(["a", "c1"]);
    expect(h.catalog.getById("c1")?.unitConversion).toEqual(conv);
    expect(h.catalog.getPulledAt()).toBe("2025-01-01T00:00:00.000Z");
    h.catalog.patchStocks([{ productId: "a", stockQty: 77 }]);
    expect(h.catalog.getById("a")?.stockQty).toBe(77);
    h.catalog.replaceAll([product({ productId: "only" })], "2025-02-01T00:00:00.000Z");
    expect(h.catalog.count()).toBe(1);
  });
});

describe("parked carts", () => {
  const lines = [{ productId: "p1", name: " Kopi ", priceMinor: 15000, qty: 2 }];

  it("validates and snapshots lines", () => {
    const built = buildParkedCart(lines, { parkId: "k1", createdAt: "t", customerName: " Budi " });
    expect(built).toMatchObject({ totalMinor: 30000, customerName: "Budi", lines: [{ name: "Kopi" }] });
    expect(() => buildParkedCart([], { parkId: "k", createdAt: "t" })).toThrow("PARK_EMPTY");
    expect(() => buildParkedCart([...lines, ...lines], { parkId: "k", createdAt: "t" })).toThrow("PARK_INVALID_LINE");
    expect(() => buildParkedCart([{ ...lines[0], qty: 0 }], { parkId: "k", createdAt: "t" })).toThrow("PARK_INVALID_LINE");
  });

  it("stores newest first, resumes and discards, and never touches the outbox", () => {
    const h = createHarness();
    const repo = new DrizzleParkedCartRepository(h.db);
    repo.save(buildParkedCart(lines, { parkId: "old", createdAt: "2025-01-01T00:00:00Z" }));
    repo.save(buildParkedCart(lines, { parkId: "new", createdAt: "2025-01-02T00:00:00Z", customerName: "Ani" }));
    expect(repo.list().map((c) => c.parkId)).toEqual(["new", "old"]);
    expect(repo.get("new")?.customerName).toBe("Ani");
    repo.delete("new");
    expect(repo.get("new")).toBeNull();
    expect(h.outbox.stats().pending).toBe(0);
  });
});

describe("customers", () => {
  it("creating offline caches the customer and queues a customer.create exactly once", async () => {
    const h = createHarness({ online: false });
    const { customer, duplicatePhone } = await h.createCustomer.execute({ name: "  Budi ", phone: "0812", email: "" });
    expect(duplicatePhone).toBe(false);
    expect(h.customers.get(customer.customerId)).toMatchObject({ name: "Budi", phone: "0812" });
    const rows = drainOutbox(h.outbox);
    expect(rows).toEqual([
      { kind: "customer.create", entityId: customer.customerId, payload: expect.objectContaining({ customer_id: customer.customerId, name: "Budi" }) },
    ]);
  });

  it("rejects a blank name", async () => {
    const h = createHarness();
    await expect(h.createCustomer.execute({ name: "   " })).rejects.toThrow();
    expect(h.outbox.stats().pending).toBe(0);
  });

  it("a server refresh never drops a customer whose create is still queued", async () => {
    const h = createHarness({ online: false });
    const { customer } = await h.createCustomer.execute({ name: "Offline Ani" });
    h.customers.replaceAll(
      [{ customerId: "srv", name: "Server Sam", phone: null, email: null, notes: null, groupName: null, storeCreditMinor: 5000, loyaltyPoints: 0, loyaltyTier: null }],
      "t",
    );
    expect(h.customers.list().map((c) => c.name).sort()).toEqual(["Offline Ani", "Server Sam"]);
    drainOutbox(h.outbox); // create reached the server
    h.customers.replaceAll([], "t2");
    expect(h.customers.get(customer.customerId)).toBeNull();
  });

  it("matches by name, phone, email and group", () => {
    const rows = [
      { customerId: "1", name: "Budi", phone: "0812", email: "b@x.id", notes: null, groupName: "VIP", storeCreditMinor: 0, loyaltyPoints: 0, loyaltyTier: null },
      { customerId: "2", name: "Ani", phone: null, email: null, notes: null, groupName: null, storeCreditMinor: 0, loyaltyPoints: 0, loyaltyTier: null },
    ];
    expect(matchCustomers(rows, "").length).toBe(2);
    expect(matchCustomers(rows, "bud").map((c) => c.customerId)).toEqual(["1"]);
    expect(matchCustomers(rows, "0812").map((c) => c.customerId)).toEqual(["1"]);
    expect(matchCustomers(rows, "vip").map((c) => c.customerId)).toEqual(["1"]);
    expect(matchCustomers(rows, "zzz")).toEqual([]);
  });
});

describe("outbox ordering across kinds", () => {
  it("replays a whole shift in the order it happened", async () => {
    const h = createHarness({ permissions: ["sales:void_unattended"] });
    h.catalog.replaceAll([product({ stockQty: 50 })], "t");
    await h.createCustomer.execute({ name: "Ani" });
    h.openShift.execute(10_000);
    h.recordCash.execute({ kind: "in", amountMinor: 1000, reason: "r" });
    const sale = await h.completeSale.execute({ cart: addProduct(emptyCart, h.catalog.getById("p1")!), method: "qris" });
    await h.voidSale.execute(sale.saleId);
    h.closeShift.execute(11_000);
    expect(drainOutbox(h.outbox).map((r) => r.kind)).toEqual([
      "customer.create",
      "shift.open",
      "cash.movement",
      "sale.sync",
      "sale.void",
      "shift.close",
    ]);
  });
});
