import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PlatformService } from "./platform.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

const operatorRow = {
  platformUserId: "op-1",
  username: "superadmin",
  role: "super_admin" as const,
  active: true,
  createdAt: new Date("2026-09-04T00:00:00.000Z"),
};

describe("PlatformService", () => {
  const service = new PlatformService();
  const actor = { userId: "op-1", role: "super_admin" as const };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("refuses to deactivate yourself", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            Object.assign(Promise.resolve([{ id: "op-2" }]), {
              limit: async () => [operatorRow],
            }),
        }),
      }),
    } as never);

    await expect(
      service.updateOperator("op-1", { active: false }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses to deactivate the last super_admin", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () =>
            Object.assign(Promise.resolve([]), {
              limit: async () => [
                {
                  ...operatorRow,
                  platformUserId: "op-2",
                  username: "ops-two",
                },
              ],
            }),
        }),
      }),
    } as never);

    await expect(
      service.updateOperator("op-2", { active: false }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a platform operator create a store owner", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              userId: "owner-new",
              username: "boss",
              role: "owner",
              storeId: "00000000-0000-4000-8000-000000000001",
              active: true,
              createdAt: new Date("2026-09-04T00:00:00.000Z"),
            },
          ],
        }),
      }),
    } as never);

    const created = await service.createAccount({
      username: "boss",
      password: "Secret123",
      role: "owner",
      store_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(created.username).toBe("boss");
    expect(created.role).toBe("owner");
  });

  it("lets a platform operator deactivate a store owner when another remains", async () => {
    let selectCalls = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => {
            selectCalls += 1;
            if (selectCalls === 1) {
              return {
                limit: async () => [
                  {
                    userId: "owner-2",
                    username: "other-owner",
                    role: "owner",
                    storeId: "00000000-0000-4000-8000-000000000001",
                    active: true,
                    createdAt: new Date("2026-09-04T00:00:00.000Z"),
                  },
                ],
              };
            }
            return Promise.resolve([{ userId: "owner-1" }]);
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [
              {
                userId: "owner-2",
                username: "other-owner",
                role: "owner",
                storeId: "00000000-0000-4000-8000-000000000001",
                active: false,
                createdAt: new Date("2026-09-04T00:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    } as never);

    const updated = await service.updateAccount("owner-2", { active: false });
    expect(updated.active).toBe(false);
    expect(updated.role).toBe("owner");
  });

  it("rejects a blank store name when provisioning a tenant", async () => {
    await expect(
      service.createStore({
        name: "  ",
        owner: { username: "owner-budi", password: "Secret123" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("provisions a store with owner and cashier", async () => {
    const storeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    let inserts = 0;
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          insert: () => ({
            values: (v: Record<string, unknown>) => ({
              returning: async () => {
                inserts += 1;
                if (v.name === "Toko Budi") {
                  return [
                    {
                      storeId,
                      name: "Toko Budi",
                      createdAt: new Date("2026-09-04T00:00:00.000Z"),
                      logoPublicId: null,
                    },
                  ];
                }
                if (v.role === "owner") {
                  return [
                    {
                      userId: "owner-b",
                      username: v.username,
                      role: "owner",
                      storeId,
                      active: true,
                      createdAt: new Date("2026-09-04T00:00:00.000Z"),
                    },
                  ];
                }
                return [
                  {
                    userId: "cashier-b",
                    username: v.username,
                    role: "cashier",
                    storeId,
                    active: true,
                    createdAt: new Date("2026-09-04T00:00:00.000Z"),
                  },
                ];
              },
              then: (resolve: (value: unknown) => unknown) =>
                Promise.resolve(undefined).then(resolve),
            }),
          }),
        }),
    } as never);

    const created = await service.createStore({
      name: "Toko Budi",
      owner: { username: "owner-budi", password: "Secret123" },
      cashier: { username: "cashier-budi", password: "Secret123" },
    });
    expect(created.store.name).toBe("Toko Budi");
    expect(created.owner.username).toBe("owner-budi");
    expect(created.owner.store_id).toBe(storeId);
    expect(created.cashier?.username).toBe("cashier-budi");
    expect(created.cashier?.store_id).toBe(storeId);
    expect(inserts).toBeGreaterThan(0);
  });
});
