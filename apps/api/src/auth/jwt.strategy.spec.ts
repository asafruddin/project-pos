import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

jest.mock("./load-permissions", () => ({
  loadRolePermissions: jest.fn().mockResolvedValue(["users:view"]),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("JwtStrategy", () => {
  const strategy = new JwtStrategy({
    getOrThrow: () => "test-secret",
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects platform audience tokens", async () => {
    await expect(
      strategy.validate({
        sub: "platform-1",
        role: "super_admin",
        aud: "platform",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects unknown audience", async () => {
    await expect(
      strategy.validate({
        sub: "u1",
        role: "cashier",
        aud: "other" as never,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("accepts store audience and loads the user", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                userId: "u1",
                username: "admin",
                role: "catalog_admin",
                active: true,
                storeId: "00000000-0000-4000-8000-000000000001",
              },
            ],
          }),
        }),
      }),
    } as never);

    const user = await strategy.validate({
      sub: "u1",
      role: "catalog_admin",
      aud: "store",
    });
    expect(user).toMatchObject({
      userId: "u1",
      role: "catalog_admin",
    });
  });
});
