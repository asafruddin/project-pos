import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformJwtStrategy } from "./platform-jwt.strategy";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("PlatformJwtStrategy", () => {
  const strategy = new PlatformJwtStrategy({
    getOrThrow: () => "test-secret",
  } as unknown as ConfigService);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rejects store audience tokens", async () => {
    await expect(
      strategy.validate({
        sub: "u1",
        role: "catalog_admin",
        aud: "store",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects tokens without platform audience", async () => {
    await expect(
      strategy.validate({
        sub: "u1",
        role: "super_admin",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("accepts platform audience and loads the operator", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                platformUserId: "p1",
                username: "superadmin",
                role: "super_admin",
                active: true,
              },
            ],
          }),
        }),
      }),
    } as never);

    const user = await strategy.validate({
      sub: "p1",
      role: "super_admin",
      aud: "platform",
    });
    expect(user).toEqual({ userId: "p1", role: "super_admin" });
  });
});
