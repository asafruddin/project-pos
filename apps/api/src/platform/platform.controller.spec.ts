import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformJwtAuthGuard } from "./platform-jwt-auth.guard";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

describe("PlatformAuthController", () => {
  it("login delegates to PlatformAuthService", async () => {
    const auth = {
      login: jest.fn().mockResolvedValue({
        access_token: "t",
        token_type: "Bearer",
        user_id: "p1",
        role: "super_admin",
      }),
      me: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformAuthController],
      providers: [{ provide: PlatformAuthService, useValue: auth }],
    })
      .overrideGuard(PlatformJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(PlatformAuthController);
    const result = await controller.login({
      login: "superadmin",
      password: "Superadmin123!",
    });
    expect(auth.login).toHaveBeenCalledWith("superadmin", "Superadmin123!");
    expect(result.role).toBe("super_admin");
  });
});

describe("PlatformController", () => {
  it("is guarded so store JWTs cannot call platform routes", async () => {
    const platform = {
      listOperators: jest.fn().mockResolvedValue({ operators: [] }),
      listAccounts: jest.fn(),
      listStores: jest.fn(),
      createOperator: jest.fn(),
      updateOperator: jest.fn(),
      createAccount: jest.fn(),
      updateAccount: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [{ provide: PlatformService, useValue: platform }],
    }).compile();

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      PlatformController,
    ) as unknown[];
    expect(guards).toContain(PlatformJwtAuthGuard);

    const controller = moduleRef.get(PlatformController);
    await controller.listOperators();
    expect(platform.listOperators).toHaveBeenCalled();
  });
});
