import type { Role } from "@pos-apps/types";
import { ACCOUNT_ROLES } from "@pos-apps/types";

export { ACCOUNT_ROLES };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ACCOUNT_ROLES as readonly string[]).includes(value);
}
