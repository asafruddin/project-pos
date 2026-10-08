import { BadRequestException, ConflictException } from "@nestjs/common";
import { VariantsService, normalizeOptions } from "./variants.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const STORE_A = "00000000-0000-4000-8000-000000000001";
const now = new Date();

const groupRow = {
  variantGroupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  storeId: STORE_A,
  name: "Ukuran",
  options: ["S", "M", "L"],
  createdAt: now,
};

describe("normalizeOptions", () => {
  it("trims, drops blanks and case-insensitive duplicates, keeps order", () => {
    expect(normalizeOptions([" L ", "", "l", "XL", "M"])).toEqual(["L", "XL", "M"]);
  });
});

describe("VariantsService", () => {
  let service: VariantsService;

  beforeEach(() => {
    service = new VariantsService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("create stores normalized options", async () => {
    const values = jest.fn().mockReturnValue({
      returning: async () => [{ ...groupRow, options: ["L", "XL"] }],
    });
    getDbMock.mockReturnValue({ insert: () => ({ values }) } as never);
    const result = await service.create(STORE_A, {
      name: " Ukuran ",
      options: [" L ", "l", "XL"],
    });
    expect(values).toHaveBeenCalledWith({
      storeId: STORE_A,
      name: "Ukuran",
      options: ["L", "XL"],
    });
    expect(result.options).toEqual(["L", "XL"]);
  });

  it("create rejects when no usable option remains", async () => {
    await expect(
      service.create(STORE_A, { name: "Ukuran", options: [" ", ""] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("create maps duplicate name to conflict", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw Object.assign(new Error("dup"), {
              code: "23505",
              constraint: "variant_groups_store_name_unique",
            });
          },
        }),
      }),
    } as never);
    await expect(
      service.create(STORE_A, { name: "Ukuran", options: ["S"] }),
    ).rejects.toMatchObject({ response: { code: "VARIANT_GROUP_CONFLICT" } });
  });

  it("remove is blocked while a product uses the group", async () => {
    let call = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => {
            call += 1;
            const rows = call === 1 ? [groupRow] : [{ productId: "p1" }];
            return { limit: async () => rows };
          },
        }),
      }),
    } as never);
    await expect(service.remove(STORE_A, groupRow.variantGroupId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
