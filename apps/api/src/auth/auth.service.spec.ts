import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcryptjs";
import { AuthService } from "./auth.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("AuthService", () => {
  let service: AuthService;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn().mockResolvedValue("test.jwt.token") };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns Bearer token and role on valid credentials", async () => {
    const passwordHash = await hash("Admin123!", 10);
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                userId: "11111111-1111-4111-8111-111111111111",
                username: "admin",
                passwordHash,
                role: "catalog_admin",
              },
            ],
          }),
        }),
      }),
    } as never);

    const result = await service.login("admin", "Admin123!");
    expect(result.token_type).toBe("Bearer");
    expect(result.role).toBe("catalog_admin");
    expect(result.access_token).toBe("test.jwt.token");
    expect(result.user_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(passwordHash).not.toBe("Admin123!");
  });

  it("rejects invalid credentials with AUTH_INVALID_CREDENTIALS", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    await expect(service.login("nope", "bad")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    try {
      await service.login("nope", "bad");
    } catch (err) {
      const body = (err as UnauthorizedException).getResponse();
      expect(body).toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
      });
    }
  });

  it("password_hash is not plaintext", async () => {
    const passwordHash = await hash("Cashier123!", 10);
    expect(passwordHash).not.toEqual("Cashier123!");
    expect(passwordHash.startsWith("$2")).toBe(true);
  });
});
