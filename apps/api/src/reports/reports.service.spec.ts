import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ReportsService, parseReportRange } from "./reports.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

const productId = "11111111-1111-4111-8111-111111111111";
const saleId = "22222222-2222-4222-8222-222222222222";
const shiftId = "33333333-3333-4333-8333-333333333333";
const cashierId = "44444444-4444-4444-8444-444444444444";
const otherId = "55555555-5555-4555-8555-555555555555";

function thenable(result: unknown) {
  const api: {
    from: jest.Mock;
    leftJoin: jest.Mock;
    innerJoin: jest.Mock;
    where: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    from: jest.fn(() => api),
    leftJoin: jest.fn(() => api),
    innerJoin: jest.fn(() => api),
    where: jest.fn(() => api),
    groupBy: jest.fn(() => api),
    orderBy: jest.fn(() => api),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return api;
}

function mockDb(results: unknown[]) {
  const queue = [...results];
  getDbMock.mockReturnValue({
    select: jest.fn(() => thenable(queue.shift() ?? [])),
  } as never);
}

const saleRow = {
  saleId,
  amountMinor: 47000,
  lines: [{ product_id: productId, qty: 2, price_minor: 25000 }],
  loyalty: { discount_minor: 0 },
  promotions: { discount_minor: 3000 },
  shiftId,
  voidedAt: null,
};

const catalogRow = {
  productId,
  name: "Latte",
  status: "inactive" as const,
  costMinor: 9000,
};

const refundRow = {
  saleId,
  refundAmountMinor: 5000,
  shiftId,
  saleShiftId: shiftId,
};

const shiftRow = { shiftId, actorId: cashierId };

const admin = { userId: otherId, role: "catalog_admin" as const };
const cashier = { userId: cashierId, role: "cashier" as const };

describe("parseReportRange", () => {
  it("rejects inverted and malformed ranges", () => {
    expect(() => parseReportRange("nope", "2026-08-13")).toThrow(
      BadRequestException,
    );
    expect(() => parseReportRange("2026-08-14", "2026-08-13")).toThrow(
      BadRequestException,
    );
  });
});

describe("ReportsService", () => {
  const service = new ReportsService();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("nets refunds, hides COGS from cashier-only, and scopes cashier totals to own shifts", async () => {
    mockDb([[saleRow], [refundRow], [catalogRow], [shiftRow]]);
    const own = await service.summary(
      { from: "2026-08-13", to: "2026-08-13" },
      cashier,
    );
    expect(own).toMatchObject({
      revenue_minor: 47000,
      txn_count: 1,
      units: 2,
      discount_minor: 3000,
      refund_minor: 5000,
      net_minor: 42000,
    });
    expect(own).not.toHaveProperty("cogs_minor");
    expect(own).not.toHaveProperty("gross_profit_minor");

    mockDb([[saleRow], [refundRow], [catalogRow], [{ shiftId, actorId: otherId }]]);
    const hidden = await service.summary(
      { from: "2026-08-13", to: "2026-08-13" },
      cashier,
    );
    expect(hidden.revenue_minor).toBe(0);
    expect(hidden.refund_minor).toBe(0);

    mockDb([[saleRow], [refundRow], [catalogRow], [shiftRow]]);
    const asAdmin = await service.summary(
      { from: "2026-08-13", to: "2026-08-13" },
      admin,
    );
    expect(asAdmin.cogs_minor).toBe(18000);
    expect(asAdmin.gross_profit_minor).toBe(29000);
    expect(asAdmin.tax_minor).toBe(0);
    expect(asAdmin.fees_minor).toBe(0);
  });

  it("keeps inactive products historically and hides margin from cashier", async () => {
    mockDb([[saleRow], [], [catalogRow], [shiftRow]]);
    const asCashier = await service.products(
      { from: "2026-08-13", to: "2026-08-13" },
      cashier,
    );
    expect(asCashier.top[0]).toMatchObject({
      product_id: productId,
      name: "Latte",
      status: "inactive",
      units: 2,
    });
    expect(asCashier.top[0]).not.toHaveProperty("margin_minor");

    mockDb([[saleRow], [], [catalogRow], [shiftRow]]);
    const asAdmin = await service.products(
      { from: "2026-08-13", to: "2026-08-13" },
      admin,
    );
    expect(asAdmin.top[0]?.margin_minor).toBe(32000);
  });

  it("forbids inventory and export for cashier-only", async () => {
    await expect(
      service.inventory({ from: "2026-08-13", to: "2026-08-13" }, cashier),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.exportCsv({ from: "2026-08-13", to: "2026-08-13" }, cashier),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("values stock at cost and ties opname variance to approved ids", async () => {
    const opnameId = "66666666-6666-4666-8666-666666666666";
    mockDb([
      [{ productId, name: "Latte", costMinor: 9000 }],
      [{ productId, bucket: "sellable", qty: "4" }],
      [{ reason: "sale", qty: "-2" }],
      [{ opnameId, status: "approved" }],
      [{ opnameId, systemQty: 5, countedQty: 3 }],
      [saleRow],
      [],
      [catalogRow],
      [shiftRow],
    ]);
    const result = await service.inventory(
      { from: "2026-08-13", to: "2026-08-13" },
      admin,
    );
    expect(result.stock_value_minor).toBe(36000);
    expect(result.movements).toEqual([{ reason: "sale", qty_delta: -2 }]);
    expect(result.opname_variances).toEqual([{ opname_id: opnameId, variance: -2 }]);
    expect(result.dead_stock).toEqual([]);
  });

  it("hides other cashiers from a cashier-only viewer", async () => {
    mockDb([
      [saleRow],
      [refundRow],
      [catalogRow],
      [
        { shiftId, actorId: otherId },
      ],
      [
        { userId: cashierId, username: "kasir" },
        { userId: otherId, username: "lain" },
      ],
    ]);
    const mine = await service.cashiers(
      { from: "2026-08-13", to: "2026-08-13" },
      cashier,
    );
    expect(mine.cashiers).toEqual([]);

    mockDb([
      [saleRow],
      [refundRow],
      [catalogRow],
      [{ shiftId, actorId: otherId }],
      [
        { userId: cashierId, username: "kasir" },
        { userId: otherId, username: "lain" },
      ],
    ]);
    const all = await service.cashiers(
      { from: "2026-08-13", to: "2026-08-13" },
      { userId: cashierId, role: "catalog_admin" },
    );
    expect(all.cashiers).toEqual([
      {
        cashier_id: otherId,
        cashier_username: "lain",
        shift_id: shiftId,
        revenue_minor: 47000,
        txn_count: 1,
        refund_minor: 5000,
      },
    ]);
  });

  it("rejects an unknown store", async () => {
    await expect(
      service.summary(
        { from: "2026-08-13", to: "2026-08-13", store_id: "not-store-1" },
        { userId: otherId, role: "catalog_admin" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exports the full product list as CSV for admin", async () => {
    mockDb([[saleRow], [refundRow], [catalogRow], [shiftRow]]);
    const csv = await service.exportCsv(
      { from: "2026-08-13", to: "2026-08-13" },
      admin,
    );
    expect(csv).toContain("42000");
    expect(csv).toContain("Latte");
    expect(csv).toContain("18000");
  });
});
