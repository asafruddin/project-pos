import { defaultPermissionsForRole } from "@pos-apps/domain";
import { loadRolePermissions } from "./load-permissions";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("loadRolePermissions", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("uses stored rows when the role has grants", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: async () => [{ resource: "sales", action: "create" }],
          limit: async () => [{ role: "cashier" }],
        }),
      }),
    } as never);
    await expect(loadRolePermissions("cashier")).resolves.toEqual([
      "sales:create",
    ]);
  });

  it("returns empty when the matrix was cleared but other roles remain", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: async () => [],
          limit: async () => [{ role: "catalog_admin" }],
        }),
      }),
    } as never);
    await expect(loadRolePermissions("cashier")).resolves.toEqual([]);
  });

  it("falls back to role defaults before the matrix is seeded", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: async () => [],
          limit: async () => [],
        }),
      }),
    } as never);
    await expect(loadRolePermissions("cashier")).resolves.toEqual(
      defaultPermissionsForRole("cashier"),
    );
  });
});
