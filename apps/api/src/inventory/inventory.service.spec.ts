import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InventoryService } from "./inventory.service";

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

const productId = "11111111-1111-4111-8111-111111111111";

describe("InventoryService", () => {
  let service: InventoryService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [InventoryService],
    }).compile();
    service = moduleRef.get(InventoryService);
    insertMovementMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("overview sums ledger buckets and flags low/out", async () => {
    getDbMock.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            orderBy: async () => [
              {
                productId,
                name: "Latte",
                sku: "LATTE",
                minQty: 5,
                trackStock: true,
              },
            ],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: async () => [
                { productId, bucket: "sellable", qty: "3" },
                { productId, bucket: "damaged", qty: "2" },
              ],
            }),
          }),
        }),
    } as never);

    const result = await service.overview();
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      sellable_qty: 3,
      damaged_qty: 2,
      is_low: true,
      is_out: false,
    });
    expect(result.products[0]).not.toHaveProperty("stock_qty");
  });

  it("overview flags is_out when sellable is zero", async () => {
    getDbMock.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            orderBy: async () => [
              {
                productId,
                name: "Espresso",
                sku: null,
                minQty: 2,
                trackStock: true,
              },
            ],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: async () => [
                { productId, bucket: "sellable", qty: "0" },
                { productId, bucket: "damaged", qty: "4" },
              ],
            }),
          }),
        }),
    } as never);

    const result = await service.overview();
    expect(result.products[0]).toMatchObject({
      sellable_qty: 0,
      damaged_qty: 4,
      is_low: true,
      is_out: true,
    });
  });

  it("markDamaged posts sellable OUT and damaged IN", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => ({
                  for: async () => [
                    {
                      productId,
                      stockQty: 10,
                    },
                  ],
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
        }),
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            orderBy: async () => [
              {
                productId,
                name: "Latte",
                sku: null,
                minQty: null,
                trackStock: true,
              },
            ],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: async () => [
                { productId, bucket: "sellable", qty: 8 },
                { productId, bucket: "damaged", qty: 2 },
              ],
            }),
          }),
        }),
    } as never);

    const result = await service.markDamaged(
      productId,
      { qty: 2, reason: "pecah" },
      "actor-1",
    );
    expect(insertMovementMock).toHaveBeenCalledTimes(2);
    expect(insertMovementMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        productId,
        storeId: "00000000-0000-4000-8000-000000000001",
        qtyDelta: -2,
        bucket: "sellable",
        sourceType: "damage",
        reason: "pecah",
      }),
    );
    expect(insertMovementMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        storeId: "00000000-0000-4000-8000-000000000001",
        qtyDelta: 2,
        bucket: "damaged",
        sourceType: "damage",
      }),
    );
    const sourceA = insertMovementMock.mock.calls[0]?.[1].sourceId;
    const sourceB = insertMovementMock.mock.calls[1]?.[1].sourceId;
    expect(sourceA).toEqual(sourceB);
    expect(sourceA).toEqual(expect.any(String));
    expect(result.damaged_qty).toBe(2);
    expect(result.sellable_qty).toBe(8);
  });

  it("markDamaged rejects blank reason", async () => {
    await expect(
      service.markDamaged(productId, { qty: 1, reason: "  " }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("markDamaged unknown product → CATALOG_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => ({
                  for: async () => [],
                }),
              }),
            }),
          }),
        }),
    } as never);

    await expect(
      service.markDamaged(productId, { qty: 1, reason: "pecah" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("unpack posts pack out and pcs in then updates projections", async () => {
    const fromId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const toId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });

    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      conversionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                      fromProductId: fromId,
                      toProductId: toId,
                      fromQty: 1,
                      toQty: 12,
                    },
                  ],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  for: async () => [
                    {
                      productId: fromId,
                      stockQty: 5,
                      trackStock: true,
                      status: "active",
                    },
                    {
                      productId: toId,
                      stockQty: 0,
                      trackStock: true,
                      status: "active",
                    },
                  ],
                }),
              }),
            }),
          update: () => ({ set: updateSet }),
        };
        return fn(tx);
      },
    } as never);

    const result = await service.unpack(toId, { pack_qty: 1 }, "actor-1");
    expect(result).toMatchObject({
      from_product_id: fromId,
      to_product_id: toId,
      from_stock_qty: 4,
      to_stock_qty: 12,
      from_delta: -1,
      to_delta: 12,
    });
    expect(insertMovementMock).toHaveBeenCalledTimes(2);
    expect(insertMovementMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        productId: fromId,
        qtyDelta: -1,
        sourceType: "unpack",
        reason: "unpack",
      }),
    );
    expect(insertMovementMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        productId: toId,
        qtyDelta: 12,
        sourceType: "unpack",
      }),
    );
    expect(updateSet).toHaveBeenCalled();
  });

  it("unpack fails closed when pack stock is insufficient", async () => {
    const fromId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const toId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: async () => [
                    {
                      conversionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                      fromProductId: fromId,
                      toProductId: toId,
                      fromQty: 1,
                      toQty: 12,
                    },
                  ],
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  for: async () => [
                    {
                      productId: fromId,
                      stockQty: 0,
                      trackStock: true,
                      status: "active",
                    },
                    {
                      productId: toId,
                      stockQty: 0,
                      trackStock: true,
                      status: "active",
                    },
                  ],
                }),
              }),
            }),
        };
        return fn(tx);
      },
    } as never);

    await expect(service.unpack(toId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

});
