import { UnauthorizedException } from "@nestjs/common";
import { PlatformJwtAuthGuard } from "./platform-jwt-auth.guard";

describe("PlatformJwtAuthGuard", () => {
  const guard = new PlatformJwtAuthGuard();

  it("rejects missing Bearer with AUTH_UNAUTHORIZED", () => {
    try {
      guard.handleRequest(null, null as never, { message: "No auth token" });
      fail("expected throw");
    } catch (err) {
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_UNAUTHORIZED",
      });
    }
  });

  it("returns the platform user when authentication succeeds", () => {
    const user = { userId: "p1", role: "super_admin" as const };
    expect(guard.handleRequest(null, user, undefined)).toEqual(user);
  });
});
