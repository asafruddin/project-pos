import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../auth/roles.guard";
import { ROLES_KEY } from "../auth/roles.decorator";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function ctx(user?: { userId: string; role: string }) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  it("allows catalog_admin when required", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      "catalog_admin",
    ]);
    expect(
      guard.canActivate(
        ctx({ userId: "u1", role: "catalog_admin" }),
      ),
    ).toBe(true);
  });

  it("forbids cashier with AUTH_FORBIDDEN", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      "catalog_admin",
    ]);
    try {
      guard.canActivate(ctx({ userId: "u2", role: "cashier" }));
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: "AUTH_FORBIDDEN",
      });
    }
  });

  it("passes through when no roles metadata", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ userId: "u1", role: "cashier" }))).toBe(
      true,
    );
  });
});

describe("ROLES_KEY", () => {
  it("is stable", () => {
    expect(ROLES_KEY).toBe("roles");
  });
});
