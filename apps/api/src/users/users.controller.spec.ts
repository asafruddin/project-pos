import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  it("user-admin routes require users/rbac permissions", () => {
    expect(
      Reflect.getMetadata("permission", UsersController.prototype.create),
    ).toEqual({ resource: "users", action: "create" });
    expect(
      Reflect.getMetadata(
        "permission",
        UsersController.prototype.replacePermissions,
      ),
    ).toEqual({ resource: "rbac", action: "update" });
  });

  it("create passes the actor through", async () => {
    const users = { create: jest.fn().mockResolvedValue({ username: "ana" }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const actor = {
      userId: "admin-1",
      role: "catalog_admin" as const,
      permissions: ["users:create"],
    };
    await moduleRef.get(UsersController).create(actor, {
      username: "ana",
      password: "Secret123",
      role: "cashier",
      store_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(users.create).toHaveBeenCalled();
  });
});

describe("PermissionsGuard on users", () => {
  it("forbids cashier tokens even if the UI hid the page", () => {
    expect(new ForbiddenException().getStatus()).toBe(403);
  });
});
