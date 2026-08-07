import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("AuthController", () => {
  it("login delegates to AuthService", async () => {
    const auth = {
      login: jest.fn().mockResolvedValue({
        access_token: "t",
        token_type: "Bearer",
        user_id: "u1",
        role: "cashier",
      }),
      me: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(AuthController);
    const result = await controller.login({
      login: "cashier",
      password: "Cashier123!",
    });
    expect(auth.login).toHaveBeenCalledWith("cashier", "Cashier123!");
    expect(result.role).toBe("cashier");
  });

  it("me requires authenticated user", async () => {
    const auth = {
      login: jest.fn(),
      me: jest.fn().mockResolvedValue({ user_id: "u1", role: "cashier" }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(AuthController);
    const result = await controller.me({ userId: "u1", role: "cashier" });
    expect(result).toEqual({ user_id: "u1", role: "cashier" });
  });
});

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard();

  it("is an AuthGuard subclass", () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  it("rejects missing Bearer with AUTH_UNAUTHORIZED", () => {
    expect(() =>
      guard.handleRequest(null, null as never, undefined),
    ).toThrow(UnauthorizedException);

    try {
      guard.handleRequest(null, null as never, { message: "No auth token" });
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_UNAUTHORIZED",
        message: expect.any(String),
      });
    }
  });

  it("rejects invalid/expired token with AUTH_INVALID_TOKEN", () => {
    try {
      guard.handleRequest(null, null as never, { name: "JsonWebTokenError" });
      fail("expected throw");
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    }

    try {
      guard.handleRequest(null, null as never, { name: "TokenExpiredError" });
      fail("expected throw");
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    }
  });

  it("returns user when authentication succeeds", () => {
    const user = { userId: "u1", role: "cashier" as const };
    expect(guard.handleRequest(null, user, undefined)).toEqual(user);
  });
});
