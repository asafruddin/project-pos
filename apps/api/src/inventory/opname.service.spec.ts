import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OpnameService } from "./opname.service";

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
const opnameId = "22222222-2222-4222-8222-222222222222";

function detailSelect() {
  return {
    select: jest
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                opnameId,
                storeId: "00000000-0000-4000-8000-000000000001",
                status: "draft",
                createdAt: new Date("2026-08-13T00:00:00Z"),
                decidedAt: null,
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: async () => [
              {
                productId,
                systemQty: 10,
                countedQty: 8,
                name: "Latte",
                sku: "LATTE",
              },
            ],
          }),
        }),
      }),
  };
}

describe("OpnameService", () => {
  let service: OpnameService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OpnameService],
    }).compile();
    service = moduleRef.get(OpnameService);
    insertMovementMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("create snapshots ledger qty and does not post movements", async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [{ productId }],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: async () => [{ productId, qty: "10" }],
            }),
          }),
        }),
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: () => ({
            returning: async () => [
              {
                opnameId,
                storeId: "00000000-0000-4000-8000-000000000001",
                status: "draft",
              },
            ],
          }),
        })
        .mockReturnValueOnce({
          values: async () => undefined,
        }),
    };
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
      } as never)
      .mockReturnValueOnce(detailSelect() as never);

    const result = await service.create({ product_ids: [productId] }, "actor-1");
    expect(insertMovementMock).not.toHaveBeenCalled();
    expect(result.lines[0]?.system_qty).toBe(10);
    expect(result.status).toBe("draft");
  });

  it("approve posts sellable delta and sets counted projection", async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async () => [
                  { opnameId, status: "draft" },
                ],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [
              { productId, countedQty: 8, systemQty: 10 },
            ],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              for: async () => [{ productId, stockQty: 10 }],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              groupBy: async () => [{ productId, qty: "10" }],
            }),
          }),
        }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
      } as never)
      .mockReturnValueOnce({
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    opnameId,
                    storeId: "00000000-0000-4000-8000-000000000001",
                    status: "approved",
                    createdAt: new Date("2026-08-13T00:00:00Z"),
                    decidedAt: new Date("2026-08-13T01:00:00Z"),
                  },
                ],
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              innerJoin: () => ({
                where: async () => [
                  {
                    productId,
                    systemQty: 10,
                    countedQty: 8,
                    name: "Latte",
                    sku: null,
                  },
                ],
              }),
            }),
          }),
      } as never);

    const result = await service.approve(opnameId, "actor-1");
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId,
        qtyDelta: -2,
        bucket: "sellable",
        sourceType: "opname",
        sourceId: opnameId,
        reason: "opname stok",
      }),
    );
    expect(result.status).toBe("approved");
    expect(result.lines[0]?.counted_qty).toBe(8);
    expect(result.lines[0]?.variance).toBe(-2);
  });

  it("saveCounts on draft does not post movements", async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async () => [{ opnameId, status: "draft" }],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [{ productId }],
          }),
        }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
      } as never)
      .mockReturnValueOnce(detailSelect() as never);

    await service.saveCounts(opnameId, {
      lines: [{ product_id: productId, counted_qty: 8 }],
    });
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("reject does not post movements", async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [{ opnameId, status: "draft" }],
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
      } as never)
      .mockReturnValueOnce({
        select: jest
          .fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    opnameId,
                    storeId: "00000000-0000-4000-8000-000000000001",
                    status: "rejected",
                    createdAt: new Date("2026-08-13T00:00:00Z"),
                    decidedAt: new Date("2026-08-13T01:00:00Z"),
                  },
                ],
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              innerJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
      } as never);

    const result = await service.reject(opnameId, "actor-1");
    expect(insertMovementMock).not.toHaveBeenCalled();
    expect(result.status).toBe("rejected");
  });

  it("unknown opname → OPNAME_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
    await expect(service.get(opnameId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("approve without counts → OPNAME_INVALID", async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async () => [{ opnameId, status: "draft" }],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [
              { productId, countedQty: null, systemQty: 10 },
            ],
          }),
        }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as never);
    await expect(service.approve(opnameId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(insertMovementMock).not.toHaveBeenCalled();
  });
});
