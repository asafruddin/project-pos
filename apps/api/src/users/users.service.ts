import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcryptjs";
import {
  ACCOUNT_ROLES,
  canAssignRole,
  canEditPermissionMatrix,
  canOpenEmployees,
  defaultPermissionsForRole,
  evaluateUserAccount,
  isAccountRole,
} from "@pos-apps/domain";
import type {
  Role,
  RolePermissionsResponse,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { ROLE_LABELS, STORE_1_ID } from "@pos-apps/types";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { rolePermissions, stores, users } from "../db/schema";
import type { AuthUser } from "../auth/jwt.strategy";
import { isRole } from "../auth/roles";

function toUser(row: typeof users.$inferSelect): UserAccount {
  return {
    user_id: row.userId,
    username: row.username,
    role: row.role,
    store_id: row.storeId,
    active: row.active,
    created_at: row.createdAt.toISOString(),
  };
}

function requireEmployees(actor: AuthUser): void {
  if (!canOpenEmployees(actor.role)) {
    throw new ForbiddenException({
      code: "AUTH_FORBIDDEN",
      message: "Hanya Owner dan Admin yang dapat mengelola karyawan.",
    });
  }
}

@Injectable()
export class UsersService {
  async list(actor: AuthUser): Promise<UserListResponse> {
    requireEmployees(actor);
    const rows = await getDb().select().from(users);
    return { users: rows.map(toUser) };
  }

  async create(
    input: {
      username: string;
      password: string;
      role: Role;
      store_id: string;
    },
    actor: AuthUser,
  ): Promise<UserAccount> {
    requireEmployees(actor);
    if (!canAssignRole({ actor_role: actor.role, target_role: input.role })) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Anda tidak dapat menetapkan peran itu.",
      });
    }
    const parsed = evaluateUserAccount({
      username: input.username,
      password: input.password,
      role: input.role,
      store_id: input.store_id,
      require_password: true,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    if (parsed.store_id !== STORE_1_ID) {
      const storeRows = await getDb()
        .select({ storeId: stores.storeId })
        .from(stores)
        .where(eq(stores.storeId, parsed.store_id))
        .limit(1);
      if (!storeRows[0]) {
        throw new BadRequestException({
          code: "USER_INVALID",
          message: "Toko tidak ditemukan.",
        });
      }
    }

    const passwordHash = await hash(input.password, 10);
    try {
      const inserted = await getDb()
        .insert(users)
        .values({
          username: parsed.username,
          passwordHash,
          role: parsed.role,
          storeId: parsed.store_id,
          active: true,
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        throw new BadRequestException({
          code: "USER_INVALID",
          message: "Gagal membuat pengguna.",
        });
      }
      return toUser(row);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Username sudah dipakai.",
      });
    }
  }

  async update(
    userId: string,
    input: {
      role?: Role;
      store_id?: string;
      active?: boolean;
      password?: string;
    },
    actor: AuthUser,
  ): Promise<UserAccount> {
    requireEmployees(actor);
    const db = getDb();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    const row = existing[0];
    if (!row) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan.",
      });
    }

    const nextRole = input.role ?? row.role;
    if (input.role && !canAssignRole({ actor_role: actor.role, target_role: input.role })) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Anda tidak dapat menetapkan peran itu.",
      });
    }

    if (input.store_id && input.store_id !== STORE_1_ID) {
      const storeRows = await db
        .select({ storeId: stores.storeId })
        .from(stores)
        .where(eq(stores.storeId, input.store_id))
        .limit(1);
      if (!storeRows[0]) {
        throw new BadRequestException({
          code: "USER_INVALID",
          message: "Toko tidak ditemukan.",
        });
      }
    }

    if (input.password != null && input.password.length > 0 && input.password.length < 8) {
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Password minimal 8 karakter.",
      });
    }

    if (input.active === false) {
      if (userId === actor.userId) {
        throw new ForbiddenException({
          code: "AUTH_FORBIDDEN",
          message: "Tidak dapat menonaktifkan akun sendiri.",
        });
      }
      if (row.role === "owner") {
        const others = await db
          .select({ userId: users.userId })
          .from(users)
          .where(and(eq(users.role, "owner"), eq(users.active, true), ne(users.userId, userId)));
        if (others.length === 0) {
          throw new ForbiddenException({
            code: "AUTH_FORBIDDEN",
            message: "Tidak dapat menonaktifkan Owner terakhir.",
          });
        }
      }
    }

    const parsed = evaluateUserAccount({
      username: row.username,
      password: input.password,
      role: nextRole,
      store_id: input.store_id ?? row.storeId,
      require_password: false,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    const passwordHash =
      input.password && input.password.length >= 8
        ? await hash(input.password, 10)
        : undefined;

    const updated = await db
      .update(users)
      .set({
        role: parsed.role,
        storeId: parsed.store_id,
        ...(input.active != null ? { active: input.active } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      })
      .where(eq(users.userId, userId))
      .returning();
    const next = updated[0];
    if (!next) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan.",
      });
    }
    return toUser(next);
  }

  async listRoles(actor: AuthUser): Promise<RolePermissionsResponse> {
    requireEmployees(actor);
    const rows = await getDb().select().from(rolePermissions);
    const byRole = new Map<Role, string[]>();
    for (const role of ACCOUNT_ROLES) {
      byRole.set(role, []);
    }
    for (const row of rows) {
      if (!isRole(row.role)) continue;
      const list = byRole.get(row.role) ?? [];
      list.push(`${row.resource}:${row.action}`);
      byRole.set(row.role, list);
    }
    return {
      roles: ACCOUNT_ROLES.map((role) => {
        const stored = byRole.get(role) ?? [];
        return {
          role,
          label: ROLE_LABELS[role],
          permissions:
            stored.length > 0 || rows.length > 0
              ? stored
              : defaultPermissionsForRole(role),
        };
      }),
    };
  }

  async replacePermissions(
    role: string,
    permissions: Array<{ resource: string; action: string }>,
    actor: AuthUser,
  ): Promise<RolePermissionsResponse> {
    if (!canEditPermissionMatrix(actor.role)) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Hanya Owner dan Admin yang dapat mengubah matriks izin.",
      });
    }
    if (!isAccountRole(role)) {
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Peran tidak dikenal.",
      });
    }
    const cleaned = permissions
      .map((p) => ({
        resource: p.resource.trim(),
        action: p.action.trim(),
      }))
      .filter((p) => p.resource && p.action);

    const db = getDb();
    await db.delete(rolePermissions).where(eq(rolePermissions.role, role));
    if (cleaned.length) {
      await db.insert(rolePermissions).values(
        cleaned.map((p) => ({
          role,
          resource: p.resource,
          action: p.action,
        })),
      );
    }
    return this.listRoles(actor);
  }
}
