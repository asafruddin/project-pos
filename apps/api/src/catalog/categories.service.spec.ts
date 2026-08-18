import { ConflictException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const STORE_A = "00000000-0000-4000-8000-000000000001";
const STORE_B = "00000000-0000-4000-8000-000000000099";
const now = new Date();

const categoryRow = {
  categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  storeId: STORE_A,
  name: "Minuman",
  createdAt: now,
};

describe("CategoriesService", () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("list returns only categories for the store", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [categoryRow],
          }),
        }),
      }),
    } as never);

    const result = await service.list(STORE_A);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.store_id).toBe(STORE_A);
    expect(result.categories[0]?.name).toBe("Minuman");
  });

  it("create maps duplicate name to conflict", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => {
            const err = Object.assign(new Error("dup"), {
              code: "23505",
              constraint: "categories_store_name_unique",
            });
            throw err;
          },
        }),
      }),
    } as never);

    await expect(service.create(STORE_A, { name: "Minuman" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("remove rejects when category is in use", async () => {
    let selectCount = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCount += 1;
              if (selectCount === 1) return [categoryRow];
              return [{ productId: "p1" }];
            },
          }),
        }),
      }),
    } as never);

    await expect(
      service.remove(STORE_A, categoryRow.categoryId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("update rejects category from another store", async () => {
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
      service.update(STORE_B, categoryRow.categoryId, { name: "Snack" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
