import { ForbiddenException } from "@nestjs/common";
import { grantsFor, hasPermission } from "@pos-apps/domain";
import type { AuthUser } from "./jwt.strategy";

export function assertPermission(
  user: Pick<AuthUser, "role" | "permissions">,
  resource: string,
  action: string,
): void {
  if (!hasPermission(grantsFor(user), resource, action)) {
    throw new ForbiddenException({
      code: "AUTH_FORBIDDEN",
      message: "Anda tidak memiliki izin untuk tindakan ini.",
    });
  }
}
