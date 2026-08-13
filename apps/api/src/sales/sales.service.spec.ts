import { BadRequestException } from "@nestjs/common";
import { acceptCompleteSale, postVoid } from "@pos-apps/domain";
import type { SyncSaleRequest } from "@pos-apps/types";
import { SalesService } from "./sales.service";

jest.mock("@pos-apps/domain", () => {
  const actual = jest.requireActual("@pos-apps/domain") as typeof import("@pos-apps/domain");
  return {
    ...actual,
    acceptCompleteSale: jest.fn(),
    postVoid: jest.fn(),
  };
});

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

jest.mock("../db/stock-ledger", () => ({
  insertStockMovement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../loyalty/loyalty-apply", () => ({
  applySaleLoyalty: jest.fn().mockResolvedValue({
    redeem_points: 0,
    discount_minor: 0,
    earned_points: 0,
  }),
  applyVoidLoyalty: jest.fn().mockResolvedValue(undefined),
}));

import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import { applySaleLoyalty } from "../loyalty/loyalty-apply";

const acceptCompleteSaleMock = acceptCompleteSale as jest.MockedFunction<
  typeof acceptCompleteSale
>;
const postVoidMock = postVoid as jest.MockedFunction<typeof postVoid>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const insertMovementMock = insertStockMovement as jest.MockedFunction<
  typeof insertStockMovement
>;
const applySaleLoyaltyMock = applySaleLoyalty as jest.MockedFunction<
  typeof applySaleLoyalty
>;

function validRequest(overrides: Partial<SyncSaleRequest> = {}): SyncSaleRequest {
  return {
    sale_id: "11111111-1111-4111-8111-111111111111",
    device_id: "device-1",
    completed_at: "2026-08-07T02:00:00.000Z",
    payment: { method: "cash", amount_minor: 36000 },
    lines: [
      {
        product_id: "22222222-2222-4222-8222-222222222222",
        qty: 2,
        price_minor: 18000,
      },
    ],
    shift_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ...overrides,
  };
}

describe("SalesService.acceptSync", () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    jest.clearAllMocks();
  });

  it("rejects invalid sync payloads", async () => {
    await expect(
      service.acceptSync(validRequest({ payment: { method: "cash", amount_minor: 1 } })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns already_accepted when sale_id exists (idempotent)", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ saleId: "11111111-1111-4111-8111-111111111111" }],
              }),
            }),
          }),
        }),
    } as never);

    await expect(service.acceptSync(validRequest())).resolves.toEqual({
      sale_id: "11111111-1111-4111-8111-111111111111",
      accepted: true,
      already_accepted: true,
    });
    expect(acceptCompleteSaleMock).not.toHaveBeenCalled();
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("accepts oversell and posts STOCK OUT (fail-open)", async () => {
    acceptCompleteSaleMock.mockReturnValue({
      ok: true,
      warned: true,
      products: [
        {
          product_id: "22222222-2222-4222-8222-222222222222",
          stock_qty: -1,
        },
      ],
    });
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
                for: async () => [
                  {
                    product_id: "22222222-2222-4222-8222-222222222222",
                    stock_qty: 1,
                  },
                ],
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
          insert: () => ({
            values: async () => undefined,
          }),
        }),
    } as never);

    await expect(service.acceptSync(validRequest())).resolves.toEqual({
      sale_id: "11111111-1111-4111-8111-111111111111",
      accepted: true,
      already_accepted: false,
    });
    expect(insertMovementMock).toHaveBeenCalledTimes(1);
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId: "22222222-2222-4222-8222-222222222222",
        qtyDelta: -2,
        bucket: "sellable",
        reason: "sale",
        sourceType: "sale",
        sourceId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("accepts a sale when customer_id is missing or invalid (fail-open)", async () => {
    acceptCompleteSaleMock.mockReturnValue({
      ok: true,
      products: [
        {
          product_id: "22222222-2222-4222-8222-222222222222",
          stock_qty: 0,
        },
      ],
    });
    const insertValues = jest.fn().mockResolvedValue(undefined);
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
                for: async () => [
                  {
                    product_id: "22222222-2222-4222-8222-222222222222",
                    stock_qty: 2,
                  },
                ],
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
          insert: () => ({
            values: insertValues,
          }),
        }),
    } as never);

    await expect(
      service.acceptSync(validRequest({ customer_id: "not-a-uuid" })),
    ).resolves.toMatchObject({ accepted: true, already_accepted: false });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: null }),
    );
  });

  it("accepts payment equal to line total minus loyalty discount", async () => {
    acceptCompleteSaleMock.mockReturnValue({
      ok: true,
      products: [
        {
          product_id: "22222222-2222-4222-8222-222222222222",
          stock_qty: 0,
        },
      ],
    });
    applySaleLoyaltyMock.mockResolvedValue({
      redeem_points: 0,
      discount_minor: 0,
      earned_points: 0,
    });
    const insertValues = jest.fn().mockResolvedValue(undefined);
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
                for: async () => [
                  {
                    product_id: "22222222-2222-4222-8222-222222222222",
                    stock_qty: 2,
                  },
                ],
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
          insert: () => ({
            values: insertValues,
          }),
        }),
    } as never);

    await expect(
      service.acceptSync(
        validRequest({
          payment: { method: "cash", amount_minor: 34000 },
          loyalty: { redeem_points: 20, discount_minor: 2000 },
        }),
      ),
    ).resolves.toMatchObject({ accepted: true, already_accepted: false });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 34000,
        loyalty: {
          redeem_points: 0,
          discount_minor: 2000,
          earned_points: 0,
        },
      }),
    );
  });

  it("rejects sync without shift_id (AD-16)", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        }),
    } as never);

    await expect(
      service.acceptSync(validRequest({ shift_id: null })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(acceptCompleteSaleMock).not.toHaveBeenCalled();
  });
});

const saleId = "11111111-1111-4111-8111-111111111111";
const voidId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "22222222-2222-4222-8222-222222222222";

function voidRequest() {
  return {
    void_id: voidId,
    sale_id: saleId,
    voided_at: "2026-08-13T04:00:00.000Z",
  };
}

describe("SalesService.acceptVoid", () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    jest.clearAllMocks();
  });

  it("is idempotent on void_id and posts no extra movements", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ voidId, saleId }],
              }),
            }),
          }),
        }),
    } as never);

    await expect(service.acceptVoid(voidRequest())).resolves.toEqual({
      void_id: voidId,
      sale_id: saleId,
      accepted: true,
      already_accepted: true,
    });
    expect(postVoidMock).not.toHaveBeenCalled();
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("rejects when the sale is not on the server yet", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            }),
        }),
    } as never);

    await expect(service.acceptVoid(voidRequest())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("posts STOCK IN sellable via PostVoid", async () => {
    postVoidMock.mockReturnValue({
      ok: true,
      lines: [{ product_id: productId, qty: 2 }],
    });
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      saleId,
                      completedAt: new Date("2026-08-13T02:00:00.000Z"),
                      lines: [{ product_id: productId, qty: 2, price_minor: 18000 }],
                    },
                  ],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  for: async () => [{ productId, stockQty: 1 }],
                }),
              }),
            }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
          insert: () => ({
            values: async () => undefined,
          }),
        }),
    } as never);

    await expect(service.acceptVoid(voidRequest())).resolves.toEqual({
      void_id: voidId,
      sale_id: saleId,
      accepted: true,
      already_accepted: false,
    });
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId,
        qtyDelta: 2,
        bucket: "sellable",
        reason: "void penjualan",
        sourceType: "void",
        sourceId: voidId,
      }),
    );
  });
});
