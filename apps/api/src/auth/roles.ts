import type { Role } from "@pos-apps/types";

export const ACCOUNT_ROLES = ["cashier", "catalog_admin"] as const satisfies readonly Role[];

export function isRole(value: unknown): value is Role {
  return value === "cashier" || value === "catalog_admin";
}
