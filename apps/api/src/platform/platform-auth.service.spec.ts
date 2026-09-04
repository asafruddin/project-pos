import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcryptjs";
import { PlatformAuthService } from "./platform-auth.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("PlatformAuthService", () => {
  let service: PlatformAuthService;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn().mockResolvedValue("platform.jwt.token") };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAuthService,
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(PlatformAuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns Bearer token with platform audience on valid credentials", async () => {
    const passwordHash = await hash("Superadmin123!", 10);
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                platformUserId: "22222222-2222-4222-8222-222222222222",
                username: "superadmin",
                passwordHash,
                role: "super_admin",
                active: true,
              },
            ],
          }),
        }),
      }),
    } as never);

    const result = await service.login("superadmin", "Superadmin123!");
    expect(result.token_type).toBe("Bearer");
    expect(result.role).toBe("super_admin");
    expect(result.access_token).toBe("platform.jwt.token");
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "22222222-2222-4222-8222-222222222222",
        role: "super_admin",
        aud: "platform",
      }),
    );
  });

  it("rejects store-style credentials that are not platform users", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    await expect(service.login("admin", "Admin123!")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
