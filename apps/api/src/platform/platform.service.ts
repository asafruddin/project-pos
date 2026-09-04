import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcryptjs";
import {
  canDeactivatePlatformOperator,
  evaluatePlatformOperator,
  evaluateUserAccount,
} from "@pos-apps/domain";
import type {
  PlatformOperator,
  PlatformOperatorListResponse,
  StoreListResponse,
  StoreRecord,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { platformUsers, stores, users } from "../db/schema";
import type { PlatformAuthUser } from "./platform-jwt.strategy";

function toOperator(
  row: typeof platformUsers.$inferSelect,
): PlatformOperator {
  return {
    user_id: row.platformUserId,
    username: row.username,
    role: row.role,
    active: row.active,
    created_at: row.createdAt.toISOString(),
  };
}

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

function toStore(row: typeof stores.$inferSelect): StoreRecord {
  return {
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PlatformService {
  async listOperators(): Promise<PlatformOperatorListResponse> {
    const rows = await getDb().select().from(platformUsers);
    return { operators: rows.map(toOperator) };
  }

  async createOperator(input: {
    username: string;
    password: string;
    role?: string;
  }): Promise<PlatformOperator> {
    const parsed = evaluatePlatformOperator({
      username: input.username,
      password: input.password,
      role: input.role ?? "super_admin",
      require_password: true,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const passwordHash = await hash(input.password, 10);
    try {
      const inserted = await getDb()
        .insert(platformUsers)
        .values({
          username: parsed.username,
          passwordHash,
          role: parsed.role,
          active: true,
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        throw new BadRequestException({
          code: "PLATFORM_USER_INVALID",
          message: "Gagal membuat operator.",
        });
      }
      return toOperator(row);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException({
        code: "PLATFORM_USER_INVALID",
        message: "Username sudah dipakai.",
      });
    }
  }

  async updateOperator(
    operatorId: string,
    input: {
      role?: string;
      active?: boolean;
      password?: string;
    },
    actor: PlatformAuthUser,
  ): Promise<PlatformOperator> {
    const db = getDb();
    const existing = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.platformUserId, operatorId))
      .limit(1);
    const row = existing[0];
    if (!row) {
      throw new NotFoundException({
        code: "PLATFORM_USER_NOT_FOUND",
        message: "Operator tidak ditemukan.",
      });
    }

    const nextRole = input.role ?? row.role;
    const parsed = evaluatePlatformOperator({
      username: row.username,
      password: input.password,
      role: nextRole,
      require_password: false,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    if (input.active === false) {
      const others = await db
        .select({ id: platformUsers.platformUserId })
        .from(platformUsers)
        .where(
          and(
            eq(platformUsers.role, "super_admin"),
            eq(platformUsers.active, true),
            ne(platformUsers.platformUserId, operatorId),
          ),
        );
      const allowed = canDeactivatePlatformOperator({
        actor_id: actor.userId,
        target_id: operatorId,
        remaining_active_super_admins: others.length,
      });
      if (!allowed.ok) {
        throw new ForbiddenException({
          code: allowed.code,
          message: allowed.message,
        });
      }
    }

    const passwordHash =
      input.password && input.password.length >= 8
        ? await hash(input.password, 10)
        : undefined;

    const updated = await db
      .update(platformUsers)
      .set({
        role: parsed.role,
        ...(input.active != null ? { active: input.active } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      })
      .where(eq(platformUsers.platformUserId, operatorId))
      .returning();
    const next = updated[0];
    if (!next) {
      throw new NotFoundException({
        code: "PLATFORM_USER_NOT_FOUND",
        message: "Operator tidak ditemukan.",
      });
    }
    return toOperator(next);
  }

  async listAccounts(): Promise<UserListResponse> {
    const rows = await getDb().select().from(users);
    return { users: rows.map(toUser) };
  }

  async listStores(): Promise<StoreListResponse> {
    const storeRows = await getDb()
      .select()
      .from(stores)
      .orderBy(asc(stores.createdAt));
    return {
      stores: storeRows.map(toStore),
      registers: [],
    };
  }

  async createAccount(input: {
    username: string;
    password: string;
    role: string;
    store_id: string;
  }): Promise<UserAccount> {
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
    await this.assertStoreExists(parsed.store_id);

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
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Username sudah dipakai.",
      });
    }
  }

  async updateAccount(
    userId: string,
    input: {
      role?: string;
      store_id?: string;
      active?: boolean;
      password?: string;
    },
  ): Promise<UserAccount> {
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

    if (input.store_id) {
      await this.assertStoreExists(parsed.store_id);
    }

    if (input.active === false && row.role === "owner") {
      const others = await db
        .select({ userId: users.userId })
        .from(users)
        .where(
          and(
            eq(users.role, "owner"),
            eq(users.active, true),
            ne(users.userId, userId),
          ),
        );
      if (others.length === 0) {
        throw new ForbiddenException({
          code: "AUTH_FORBIDDEN",
          message: "Tidak dapat menonaktifkan Owner terakhir.",
        });
      }
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

  private async assertStoreExists(storeId: string): Promise<void> {
    if (storeId === STORE_1_ID) return;
    const storeRows = await getDb()
      .select({ storeId: stores.storeId })
      .from(stores)
      .where(eq(stores.storeId, storeId))
      .limit(1);
    if (!storeRows[0]) {
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Toko tidak ditemukan.",
      });
    }
  }
}
