import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { toolsFor, type AssistantDeps } from "./tools";

const storeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "11111111-1111-4111-8111-111111111111";
const foreignProductId = "99999999-9999-4999-8999-999999999999";

const owner: AuthUser = { userId: "owner-1", role: "owner", storeId: storeA };
const cashier: AuthUser = { userId: "cashier-1", role: "cashier", storeId: storeA };
const inventoryStaff: AuthUser = {
  userId: "inv-1",
  role: "inventory_staff",
  storeId: storeA,
};

const product = {
  product_id: productId,
  name: "Kopi Susu",
  sku: "KS-1",
  status: "active" as const,
  price_minor: 15000,
  stock_qty: 12,
  track_stock: true,
};

function makeDeps(): AssistantDeps & {
  reports: { [K in keyof AssistantDeps["reports"]]: jest.Mock };
  inventory: { overview: jest.Mock };
  customers: { list: jest.Mock };
  products: { search: jest.Mock; get: jest.Mock };
} {
  return {
    reports: {
      summary: jest.fn(),
      products: jest.fn(),
      cashiers: jest.fn(),
      inventory: jest.fn(),
    },
    inventory: { overview: jest.fn() },
    customers: { list: jest.fn() },
    products: {
      search: jest.fn(async () => [product]),
      get: jest.fn(async (_store: string, id: string) =>
        id === productId ? product : null,
      ),
    },
  };
}

async function run(tools: ReturnType<typeof toolsFor>, name: string, input: unknown) {
  const tool = tools[name];
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.execute(tool.inputSchema.parse(input));
}

describe("assistant tools: permissions", () => {
  it("gives owners every read and propose tool", () => {
    expect(Object.keys(toolsFor(owner, makeDeps())).sort()).toEqual(
      [
        "get_cashier_performance",
        "get_inventory_insights",
        "get_product_ranking",
        "get_sales_summary",
        "get_stock_levels",
        "propose_adjust_stock",
        "propose_create_promotion",
        "propose_set_product_status",
        "propose_update_price",
        "search_customers",
        "search_products",
      ].sort(),
    );
  });

  it("gives cashiers no financial insights and no write proposals", () => {
    const names = Object.keys(toolsFor(cashier, makeDeps()));
    expect(names).toEqual(
      expect.arrayContaining(["get_sales_summary", "get_product_ranking", "search_products"]),
    );
    expect(names).not.toContain("get_inventory_insights");
    expect(names).not.toContain("get_stock_levels");
    expect(names.filter((n) => n.startsWith("propose_"))).toEqual([]);
  });

  it("follows matrix grants instead of role defaults when present", () => {
    const names = Object.keys(
      toolsFor({ ...cashier, permissions: ["reports:view"] }, makeDeps()),
    );
    expect(names.sort()).toEqual(
      ["get_cashier_performance", "get_product_ranking", "get_sales_summary"].sort(),
    );
  });

  it("gives inventory staff stock tools but not price or promo proposals", () => {
    const names = Object.keys(toolsFor(inventoryStaff, makeDeps()));
    expect(names).toContain("get_stock_levels");
    expect(names).toContain("propose_adjust_stock");
    expect(names).not.toContain("propose_update_price");
    expect(names).not.toContain("propose_create_promotion");
    expect(names).not.toContain("get_inventory_insights");
  });
});

describe("assistant tools: read", () => {
  it("passes the viewer to reports and formats money", async () => {
    const deps = makeDeps();
    deps.reports.summary.mockResolvedValue({
      store_id: storeA,
      from: "2026-10-01",
      to: "2026-10-07",
      revenue_minor: 150000,
      txn_count: 10,
      units: 12,
      aov_minor: 15000,
      discount_minor: 0,
      refund_minor: 0,
      net_minor: 150000,
    });
    const out = await run(toolsFor(cashier, deps), "get_sales_summary", {
      from: "2026-10-01",
      to: "2026-10-07",
    });
    expect(deps.reports.summary).toHaveBeenCalledWith(
      { from: "2026-10-01", to: "2026-10-07" },
      cashier,
    );
    expect(out).toMatchObject({ revenue_formatted: expect.stringContaining("150.000") });
  });

  it("returns the slow list when asked and caps rows", async () => {
    const deps = makeDeps();
    const row = (name: string) => ({
      product_id: name,
      name,
      status: "active",
      units: 1,
      revenue_minor: 1000,
    });
    deps.reports.products.mockResolvedValue({
      store_id: storeA,
      from: "2026-10-01",
      to: "2026-10-01",
      top: [row("a")],
      slow: [row("x"), row("y"), row("z")],
    });
    const out = (await run(toolsFor(owner, deps), "get_product_ranking", {
      from: "2026-10-01",
      to: "2026-10-01",
      order: "slow",
      limit: 2,
    })) as { products: Array<{ name: string }> };
    expect(out.products.map((p) => p.name)).toEqual(["x", "y"]);
  });

  it("turns service errors into a tool result", async () => {
    const deps = makeDeps();
    deps.reports.summary.mockRejectedValue(
      new BadRequestException({
        code: "REPORT_INVALID_RANGE",
        message: "Rentang laporan maksimal 366 hari.",
      }),
    );
    await expect(
      run(toolsFor(owner, deps), "get_sales_summary", { from: "2024-01-01", to: "2026-01-01" }),
    ).resolves.toEqual({ error: "Rentang laporan maksimal 366 hari." });
  });

  it("scopes stock and product lookups to the viewer's store", async () => {
    const deps = makeDeps();
    deps.inventory.overview.mockResolvedValue({
      store_id: storeA,
      products: [
        { product_id: "p1", name: "Gula", sku: null, min_qty: 5, track_stock: true, sellable_qty: 2, damaged_qty: 0, in_transit_qty: 0, is_low: true, is_out: false },
        { product_id: "p2", name: "Susu", sku: null, min_qty: 5, track_stock: true, sellable_qty: 40, damaged_qty: 0, in_transit_qty: 0, is_low: false, is_out: false },
      ],
    });
    const tools = toolsFor(owner, deps);
    const stock = (await run(tools, "get_stock_levels", { low_only: true })) as {
      products: Array<{ name: string }>;
    };
    expect(deps.inventory.overview).toHaveBeenCalledWith(storeA);
    expect(stock.products.map((p) => p.name)).toEqual(["Gula"]);

    await run(tools, "search_products", { query: "kopi" });
    expect(deps.products.search).toHaveBeenCalledWith(storeA, "kopi", 10);
  });

  it("does not send customer contact details to the model", async () => {
    const deps = makeDeps();
    deps.customers.list.mockResolvedValue({
      customers: [
        {
          customer_id: "c1",
          name: "Budi",
          phone: "0812",
          email: "budi@example.com",
          group_name: null,
          loyalty_points: 10,
          loyalty_tier: null,
          store_credit_minor: 0,
        },
      ],
    });
    const out = await run(toolsFor(owner, deps), "search_customers", { query: "budi" });
    expect(JSON.stringify(out)).not.toMatch(/0812|budi@example\.com/);
  });
});

describe("assistant tools: proposals", () => {
  it("builds a price proposal without writing anything", async () => {
    const deps = makeDeps();
    const out = await run(toolsFor(owner, deps), "propose_update_price", {
      product_id: productId,
      price_minor: 18000,
    });
    expect(deps.products.get).toHaveBeenCalledWith(storeA, productId);
    expect(out).toMatchObject({
      kind: "update_price",
      product_id: productId,
      payload: { price_minor: 18000 },
      changes: [{ field: "Harga", from: expect.stringContaining("15.000"), to: expect.stringContaining("18.000") }],
    });
  });

  it("refuses products outside the viewer's store", async () => {
    const out = await run(toolsFor(owner, makeDeps()), "propose_set_product_status", {
      product_id: foreignProductId,
      status: "inactive",
    });
    expect(out).toEqual({ error: "Produk tidak ditemukan di toko ini." });
  });

  it("rejects no-op changes", async () => {
    const out = await run(toolsFor(owner, makeDeps()), "propose_update_price", {
      product_id: productId,
      price_minor: 15000,
    });
    expect(out).toMatchObject({ error: expect.stringContaining("sudah") });
  });

  it("requires a reason for stock adjustments", () => {
    const tool = toolsFor(owner, makeDeps()).propose_adjust_stock;
    expect(() =>
      tool.inputSchema.parse({ product_id: productId, stock_qty: 5, reason: "" }),
    ).toThrow();
  });

  it("builds a promotion payload the server will accept", async () => {
    const out = await run(toolsFor(owner, makeDeps()), "propose_create_promotion", {
      name: "Diskon Kopi",
      kind: "percent",
      percent: 15,
      product_ids: [productId],
      starts_on: "2026-10-20",
      ends_on: "2026-10-27",
      hour_start: 14,
      hour_end: 16,
    });
    expect(out).toMatchObject({
      kind: "create_promotion",
      payload: {
        name: "Diskon Kopi",
        kind: "percent",
        percent_bps: 1500,
        fixed_minor: null,
        product_ids: [productId],
        starts_at: "2026-10-20T00:00:00.000Z",
        ends_at: "2026-10-27T23:59:59.999Z",
        hour_start: 14,
        hour_end: 16,
      },
    });
  });

  it("rejects invalid promotion rules before proposing", async () => {
    const tools = toolsFor(owner, makeDeps());
    await expect(
      run(tools, "propose_create_promotion", { name: "X", kind: "percent" }),
    ).resolves.toMatchObject({ error: expect.stringContaining("tidak valid") });
    await expect(
      run(tools, "propose_create_promotion", { name: "X", kind: "fixed", fixed_minor: 1000, hour_start: 9 }),
    ).resolves.toMatchObject({ error: expect.stringContaining("jam") });
    await expect(
      run(tools, "propose_create_promotion", { name: "X", kind: "fixed", fixed_minor: 1000, product_ids: [foreignProductId] }),
    ).resolves.toEqual({ error: "Produk tidak ditemukan di toko ini." });
  });
});
