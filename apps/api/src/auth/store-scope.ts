import { ForbiddenException } from "@nestjs/common";
import { STORE_1_ID } from "@pos-apps/types";
import type { AuthUser } from "./jwt.strategy";

export function actorStoreId(user: {
  storeId?: string | null;
}): string {
  const id = user.storeId?.trim();
  return id || STORE_1_ID;
}

export function assertSameStore(
  user: AuthUser,
  storeId: string,
): void {
  if (storeId !== actorStoreId(user)) {
    throw new ForbiddenException({
      code: "AUTH_FORBIDDEN",
      message: "Toko tidak sesuai.",
    });
  }
}
