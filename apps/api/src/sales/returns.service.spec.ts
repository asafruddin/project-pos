import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ReturnsService } from "./returns.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

jest.mock("../db/stock-ledger", () => ({
  insertStockMovement: jest.fn().mockResolvedValue(undefined),
}));

import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const insertMovementMock = insertStockMovement as jest.MockedFunction<
  typeof insertStockMovement
>;

const saleId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const returnId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const openReturn = {
  return_id: returnId,
  sale_id: saleId,
  reason: "salah pesan",
  status: "open" as const,
  amount_minor: 36000,
  refund_amount_minor: null,
  refunded_at: null,
  exchange_sale_id: null,
  lines: [],
  created_at: "2026-08-13T00:00:00.000Z",
};

describe("ReturnsService", () => {
  let service: ReturnsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReturnsService],
    }).compile();
    service = moduleRef.get(ReturnsService);
    insertMovementMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("lookup 404 when sale is missing", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
    await expect(service.lookup(saleId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("create posts STOCK IN sellable for resellable", async () => {
    jest.spyOn(service, "get").mockResolvedValue(openReturn);
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  saleId,
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
              for: async () => [{ productId, stockQty: 1 }],
            }),
          }),
        }),
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: () => ({
            returning: async () => [{ returnId }],
          }),
        })
        .mockReturnValue({
          values: async () => undefined,
        }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (inner: unknown) => Promise<unknown>) => fn(tx),
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    } as never);

    await expect(
      service.create(saleId, {
        reason: "salah pesan",
        lines: [{ product_id: productId, qty: 1, decision: "resellable" }],
      }),
    ).resolves.toEqual(openReturn);
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId,
        qtyDelta: 1,
        bucket: "sellable",
        reason: "retur penjualan",
        sourceType: "return",
        sourceId: returnId,
      }),
    );
  });

  it("warranty posts no stock movement", async () => {
    jest.spyOn(service, "get").mockResolvedValue(openReturn);
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  saleId,
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
        }),
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: () => ({
            returning: async () => [{ returnId }],
          }),
        })
        .mockReturnValue({
          values: async () => undefined,
        }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (inner: unknown) => Promise<unknown>) => fn(tx),
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    } as never);

    await service.create(saleId, {
      reason: "garansi",
      lines: [{ product_id: productId, qty: 1, decision: "warranty" }],
    });
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("refund rejects a mismatched amount and posts no movements", async () => {
    jest.spyOn(service, "get").mockResolvedValue(openReturn);
    await expect(
      service.refund(returnId, { amount_minor: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertMovementMock).not.toHaveBeenCalled();
  });
});
