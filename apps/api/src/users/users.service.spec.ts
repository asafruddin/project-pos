import { ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("UsersService", () => {
  const service = new UsersService();
  const admin = {
    userId: "admin-1",
    role: "catalog_admin" as const,
    permissions: ["users:create", "users:view", "users:update", "rbac:update"],
  };
  const cashier = {
    userId: "c1",
    role: "cashier" as const,
    permissions: ["sales:create"],
  };
  const manager = {
    userId: "m1",
    role: "store_manager" as const,
    permissions: ["returns:approve"],
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("rejects cashier user-admin", async () => {
    await expect(service.list(cashier)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects store manager creating an admin", async () => {
    await expect(
      service.create(
        {
          username: "boss",
          password: "Secret123",
          role: "catalog_admin",
          store_id: "00000000-0000-4000-8000-000000000001",
        },
        manager,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects store manager editing the permission matrix", async () => {
    await expect(
      service.replacePermissions("cashier", [], manager),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets admin assign cashier", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              userId: "u-new",
              username: "ana",
              role: "cashier",
              storeId: "00000000-0000-4000-8000-000000000001",
              active: true,
              createdAt: new Date("2026-08-13T00:00:00.000Z"),
            },
          ],
        }),
      }),
    } as never);
    const created = await service.create(
      {
        username: "ana",
        password: "Secret123",
        role: "cashier",
        store_id: "00000000-0000-4000-8000-000000000001",
      },
      admin,
    );
    expect(created.username).toBe("ana");
    expect(created.role).toBe("cashier");
  });
});
