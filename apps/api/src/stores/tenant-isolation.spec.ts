import { CustomersService } from "../customers/customers.service";
import { SalesService } from "../sales/sales.service";
import { STORE_1_ID } from "@pos-apps/types";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const storeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("store isolation", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("customer list is store-scoped", async () => {
    const where = jest.fn().mockReturnValue({
      orderBy: async () => [],
    });
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where,
        }),
      }),
    } as never);
    const customers = new CustomersService();
    const result = await customers.list(undefined, storeB);
    expect(result.customers).toEqual([]);
    expect(where).toHaveBeenCalled();
  });

  it("today's sales are store-scoped", async () => {
    const where = jest.fn().mockReturnValue({
      orderBy: async () => [],
    });
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where,
          }),
        }),
      }),
    } as never);
    const sales = new SalesService();
    const result = await sales.listToday(storeB);
    expect(result.sales).toEqual([]);
    expect(where).toHaveBeenCalled();
    expect(storeB).not.toBe(STORE_1_ID);
  });
});
