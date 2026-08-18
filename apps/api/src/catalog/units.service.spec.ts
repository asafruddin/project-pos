import { ConflictException, NotFoundException } from "@nestjs/common";
import { UnitsService } from "./units.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const STORE_A = "00000000-0000-4000-8000-000000000001";
const STORE_B = "00000000-0000-4000-8000-000000000099";
const now = new Date();

const unitRow = {
  unitId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  storeId: STORE_A,
  name: "pcs",
  createdAt: now,
};

describe("UnitsService", () => {
  let service: UnitsService;

  beforeEach(() => {
    service = new UnitsService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("list returns only units for the store", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [unitRow],
          }),
        }),
      }),
    } as never);

    const result = await service.list(STORE_A);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]?.store_id).toBe(STORE_A);
    expect(result.units[0]?.name).toBe("pcs");
  });

  it("create maps duplicate name to conflict", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => {
            const err = Object.assign(new Error("dup"), {
              code: "23505",
              constraint: "units_store_name_unique",
            });
            throw err;
          },
        }),
      }),
    } as never);

    await expect(service.create(STORE_A, { name: "pcs" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("remove rejects when unit is in use", async () => {
    let selectCount = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCount += 1;
              if (selectCount === 1) return [unitRow];
              return [{ productId: "p1" }];
            },
          }),
        }),
      }),
    } as never);

    await expect(service.remove(STORE_A, unitRow.unitId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("update rejects unit from another store", async () => {
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
      service.update(STORE_B, unitRow.unitId, { name: "kg" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
