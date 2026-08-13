import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSION_KEY } from "./permission.decorator";

describe("PermissionsGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  function ctx(user?: {
    userId: string;
    role: string;
    permissions?: string[];
  }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  it("allows a store manager to refund when grants include returns:approve", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      resource: "returns",
      action: "approve",
    });
    expect(
      guard.canActivate(
        ctx({
          userId: "m1",
          role: "store_manager",
          permissions: ["returns:approve"],
        }),
      ),
    ).toBe(true);
  });

  it("denies cashier refund even if the UI hid the button", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      resource: "returns",
      action: "approve",
    });
    try {
      guard.canActivate(
        ctx({ userId: "c1", role: "cashier", permissions: ["sales:create"] }),
      );
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: "AUTH_FORBIDDEN",
      });
    }
  });

  it("denies supervisor refund", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      resource: "returns",
      action: "approve",
    });
    expect(() =>
      guard.canActivate(
        ctx({
          userId: "s1",
          role: "supervisor",
          permissions: ["sales:void_unattended"],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("passes through when no permission metadata", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(
      guard.canActivate(ctx({ userId: "u1", role: "cashier" })),
    ).toBe(true);
  });
});

describe("PERMISSION_KEY", () => {
  it("is stable", () => {
    expect(PERMISSION_KEY).toBe("permission");
  });
});
