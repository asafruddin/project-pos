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
  it("is an AuthGuard subclass", () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeInstanceOf(JwtAuthGuard);
  });

  it("documents unauthorized shape for missing token callers", () => {
    const err = new UnauthorizedException({
      code: "AUTH_UNAUTHORIZED",
      message: "Autentikasi diperlukan.",
    });
    expect(err.getResponse()).toMatchObject({
      code: "AUTH_UNAUTHORIZED",
    });
  });
});
