import { defaultPermissionsForRole, isAccountRole } from "@pos-apps/domain";
import type { Role } from "@pos-apps/types";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { rolePermissions } from "../db/schema";

export async function loadRolePermissions(role: Role): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      resource: rolePermissions.resource,
      action: rolePermissions.action,
    })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role));
  if (rows.length > 0) {
    return rows.map((row) => `${row.resource}:${row.action}`);
  }
  const seeded = await db
    .select({ role: rolePermissions.role })
    .from(rolePermissions)
    .limit(1);
  if (seeded.length > 0) {
    return [];
  }
  return isAccountRole(role) ? defaultPermissionsForRole(role) : [];
}
