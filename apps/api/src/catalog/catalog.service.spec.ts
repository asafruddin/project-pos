import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CatalogService } from "./catalog.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("CatalogService", () => {
  let service: CatalogService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CatalogService],
    }).compile();
    service = moduleRef.get(CatalogService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("create persists product with minor price and stock", async () => {
    const now = new Date();
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              productId: "11111111-1111-4111-8111-111111111111",
              name: "Latte",
              priceMinor: 25000,
              stockQty: 5,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      }),
    } as never);

    const result = await service.create({
      name: "Latte",
      price_minor: 25000,
      stock_qty: 5,
    });
    expect(result.price_minor).toBe(25000);
    expect(result.stock_qty).toBe(5);
  });

  it("setStock rejects negative via AdjustStock", async () => {
    const now = new Date();
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                productId: "11111111-1111-4111-8111-111111111111",
                name: "Latte",
                priceMinor: 25000,
                stockQty: 5,
                createdAt: now,
                updatedAt: now,
              },
            ],
          }),
        }),
      }),
    } as never);

    await expect(
      service.setStock("11111111-1111-4111-8111-111111111111", -1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("update unknown product → CATALOG_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    try {
      await service.update("11111111-1111-4111-8111-111111111111", {
        name: "X",
      });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({
        code: "CATALOG_NOT_FOUND",
      });
    }
  });
});
