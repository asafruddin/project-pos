import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CatalogService } from "./catalog.service";
import { MediaService } from "../media/media.service";

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

const now = new Date();
const productRow = {
  productId: "11111111-1111-4111-8111-111111111111",
  name: "Latte",
  priceMinor: 25000,
  stockQty: 5,
  sku: null,
  barcode: null,
  description: null,
  status: "active" as const,
  costMinor: null,
  compareAtMinor: null,
  minQty: null,
  maxQty: null,
  trackStock: true,
  parentId: null,
  categoryId: null,
  brandId: null,
  unitId: null,
  tags: [],
  createdAt: now,
  updatedAt: now,
};

describe("CatalogService", () => {
  let service: CatalogService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: MediaService,
          useValue: {
            imagesFor: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
    insertMovementMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("create persists product with minor price and stock", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => ({
            values: () => ({
              returning: async () => [productRow],
            }),
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
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
    expect(insertMovementMock).toHaveBeenCalled();
  });

  it("setStock rejects blank reason", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => ({
                  for: async () => [productRow],
                }),
              }),
            }),
          }),
        }),
    } as never);

    await expect(
      service.setStock("11111111-1111-4111-8111-111111111111", {
        stock_qty: 8,
        reason: "   ",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("setStock with reason posts a movement", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => ({
                  for: async () => [productRow],
                }),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => ({
                returning: async () => [{ ...productRow, stockQty: 8 }],
              }),
            }),
          }),
        }),
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                leftJoin: () => ({
                  where: () => ({
                    limit: async () => [
                      {
                        categoryName: null,
                        brandName: null,
                        unitName: null,
                      },
                    ],
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
        }),
    } as never);

    const result = await service.setStock(
      "11111111-1111-4111-8111-111111111111",
      { stock_qty: 8, reason: "koreksi hitung" },
    );
    expect(result.stock_qty).toBe(8);
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId: "11111111-1111-4111-8111-111111111111",
        qtyDelta: 3,
        bucket: "sellable",
        reason: "koreksi hitung",
        sourceType: "adjust",
      }),
    );
  });

  it("create duplicate SKU → CATALOG_SKU_CONFLICT", async () => {
    getDbMock.mockReturnValue({
      transaction: async () => {
        throw Object.assign(new Error("duplicate"), {
          code: "23505",
          constraint: "products_sku_unique",
        });
      },
    } as never);

    try {
      await service.create({
        name: "Latte",
        price_minor: 25000,
        stock_qty: 5,
        sku: "LATTE",
      });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        code: "CATALOG_SKU_CONFLICT",
      });
    }
  });

  it("create with missing parent → CATALOG_INVALID_PARENT", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    await expect(
      service.create({
        name: "Latte M",
        price_minor: 25000,
        stock_qty: 1,
        parent_id: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("update self parent_id → CATALOG_INVALID_PARENT", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [productRow],
          }),
        }),
      }),
    } as never);

    try {
      await service.update(productRow.productId, {
        parent_id: productRow.productId,
      });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: "CATALOG_INVALID_PARENT",
      });
    }
  });

  it("list includes inactive products for Dashboard", async () => {
    const inactive = {
      ...productRow,
      productId: "33333333-3333-4333-8333-333333333333",
      name: "Old",
      status: "inactive" as const,
    };
    getDbMock.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: async () => [{ value: 2 }],
        })
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                leftJoin: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: async () => [
                        {
                          product: productRow,
                          categoryName: null,
                          brandName: null,
                          unitName: null,
                        },
                        {
                          product: inactive,
                          categoryName: null,
                          brandName: null,
                          unitName: null,
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
        }),
    } as never);

    const result = await service.list();
    expect(result.products).toHaveLength(2);
    expect(result.products.map((p) => p.status)).toEqual(["active", "inactive"]);
    expect(result.products[0]?.price_minor).toBe(25000);
    expect(result.meta).toEqual({
      page: 1,
      limit: 50,
      total: 2,
      total_pages: 1,
    });
  });

  it("list overlays store selling price when a store is passed", async () => {
    getDbMock.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: async () => [{ value: 1 }],
        })
        .mockReturnValueOnce({
          from: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                leftJoin: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: async () => [
                        {
                          product: productRow,
                          categoryName: null,
                          brandName: null,
                          unitName: null,
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [
              { productId: productRow.productId, priceMinor: 30000 },
            ],
          }),
        }),
    } as never);

    const result = await service.list("22222222-2222-4222-8222-222222222222");
    expect(result.products[0]?.price_minor).toBe(30000);
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

  it("create with category_name and unit_name attaches store-scoped rows", async () => {
    const created = {
      ...productRow,
      categoryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      unitId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    const storeId = "00000000-0000-4000-8000-000000000001";
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
          insert: () => ({
            values: (v: Record<string, unknown>) => ({
              returning: async () => {
                if (v.storeId && v.name === "Minuman") {
                  return [
                    {
                      categoryId: created.categoryId,
                      storeId: v.storeId,
                      name: "Minuman",
                    },
                  ];
                }
                if (v.storeId && v.name === "pcs") {
                  return [
                    { unitId: created.unitId, storeId: v.storeId, name: "pcs" },
                  ];
                }
                return [created];
              },
            }),
          }),
        }),
    } as never);

    const result = await service.create(
      {
        name: "Latte",
        price_minor: 25000,
        stock_qty: 5,
        category_name: "Minuman",
        unit_name: "pcs",
      },
      undefined,
      storeId,
    );
    expect(result.category_name).toBe("Minuman");
    expect(result.unit_name).toBe("pcs");
    expect(result.category_id).toBe(created.categoryId);
    expect(result.unit_id).toBe(created.unitId);
  });

  it("importProducts creates a new SKU and updates an existing SKU", async () => {
    const existingId = "22222222-2222-4222-8222-222222222222";
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
            then: (
              resolve: (value: Array<{ productId: string; sku: string }>) => unknown,
            ) =>
              resolve([{ productId: existingId, sku: "OLD-1" }]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      product_id: "33333333-3333-4333-8333-333333333333",
      name: "Baru",
      price_minor: 1000,
      stock_qty: 1,
    } as never);
    const update = jest.spyOn(service, "update").mockResolvedValue({} as never);
    const setStock = jest.spyOn(service, "setStock").mockResolvedValue({} as never);

    const result = await service.importProducts(
      [
        {
          row: 2,
          sku: "NEW-1",
          parentSku: null,
          name: "Baru",
          priceMinor: 1000,
          stockQty: 1,
        },
        {
          row: 3,
          sku: "OLD-1",
          parentSku: null,
          name: "Lama",
          priceMinor: 2000,
          stockQty: 8,
        },
      ],
      [],
      "actor-1",
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "NEW-1", name: "Baru", stock_qty: 1 }),
      "actor-1",
      expect.any(String),
    );
    expect(update).toHaveBeenCalledWith(
      existingId,
      expect.objectContaining({ name: "Lama", price_minor: 2000 }),
      expect.any(String),
    );
    expect(setStock).toHaveBeenCalledWith(
      existingId,
      { stock_qty: 8, reason: "import" },
      "actor-1",
    );
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.updated_skus).toEqual(["OLD-1"]);
    create.mockRestore();
    update.mockRestore();
    setStock.mockRestore();
  });

  it("importProducts reports a missing parent SKU without aborting other rows", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
            then: (resolve: (value: unknown[]) => unknown) => resolve([]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      product_id: "44444444-4444-4444-8444-444444444444",
      name: "Anak",
      price_minor: 500,
      stock_qty: 2,
    } as never);

    const result = await service.importProducts(
      [
        {
          row: 2,
          sku: "CHILD-1",
          parentSku: "MISSING",
          name: "Anak",
          priceMinor: 500,
          stockQty: 2,
        },
        {
          row: 3,
          sku: "SOLO-1",
          parentSku: null,
          name: "Solo",
          priceMinor: 700,
          stockQty: 1,
        },
      ],
      [],
      "actor-1",
    );

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        row: 2,
        sku: "CHILD-1",
        message: expect.stringContaining("MISSING"),
      }),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    create.mockRestore();
  });
});
