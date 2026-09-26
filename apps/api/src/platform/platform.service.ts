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
  CreatePlatformStoreResponse,
  PlatformOperator,
  PlatformOperatorListResponse,
  StoreListResponse,
  StoreRecord,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { and, asc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client";
import { platformUsers, registers, stores, users } from "../db/schema";
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
    logo_public_id: row.logoPublicId ?? null,
    logo_secure_url: row.logoSecureUrl ?? null,
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
    const db = getDb();
    const [storeRows, registerRows] = await Promise.all([
      db.select().from(stores).orderBy(asc(stores.createdAt)),
      db.select().from(registers).orderBy(asc(registers.createdAt)),
    ]);
    return {
      stores: storeRows.map(toStore),
      registers: registerRows.map((row) => ({
        register_id: row.registerId,
        store_id: row.storeId,
        name: row.name,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  async createStore(input: {
    name: string;
    owner: { username: string; password: string };
    cashier?: { username: string; password: string };
  }): Promise<CreatePlatformStoreResponse> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "STORE_INVALID",
        message: "Nama toko wajib diisi.",
      });
    }

    const ownerParsed = evaluateUserAccount({
      username: input.owner.username,
      password: input.owner.password,
      role: "owner",
      store_id: STORE_1_ID,
      require_password: true,
    });
    if (!ownerParsed.ok) {
      throw new BadRequestException({
        code: ownerParsed.code,
        message: ownerParsed.message,
      });
    }

    let cashierParsed: Extract<
      ReturnType<typeof evaluateUserAccount>,
      { ok: true }
    > | null = null;
    if (input.cashier) {
      const parsed = evaluateUserAccount({
        username: input.cashier.username,
        password: input.cashier.password,
        role: "cashier",
        store_id: STORE_1_ID,
        require_password: true,
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }
      if (parsed.username === ownerParsed.username) {
        throw new BadRequestException({
          code: "USER_INVALID",
          message: "Username kasir harus berbeda dari owner.",
        });
      }
      cashierParsed = parsed;
    }

    const db = getDb();
    try {
      return await db.transaction(async (tx) => {
        const [store] = await tx
          .insert(stores)
          .values({ storeId: randomUUID(), name })
          .returning();
        if (!store) {
          throw new BadRequestException({
            code: "STORE_INVALID",
            message: "Gagal membuat toko.",
          });
        }
        await tx.insert(registers).values({
          registerId: randomUUID(),
          storeId: store.storeId,
          name: "Register 1",
        });

        const ownerHash = await hash(input.owner.password, 10);
        const [ownerRow] = await tx
          .insert(users)
          .values({
            username: ownerParsed.username,
            passwordHash: ownerHash,
            role: "owner",
            storeId: store.storeId,
            active: true,
          })
          .returning();
        if (!ownerRow) {
          throw new BadRequestException({
            code: "USER_INVALID",
            message: "Gagal membuat owner.",
          });
        }

        let cashier: UserAccount | null = null;
        if (cashierParsed && input.cashier) {
          const cashierHash = await hash(input.cashier.password, 10);
          const [cashierRow] = await tx
            .insert(users)
            .values({
              username: cashierParsed.username,
              passwordHash: cashierHash,
              role: "cashier",
              storeId: store.storeId,
              active: true,
            })
            .returning();
          if (!cashierRow) {
            throw new BadRequestException({
              code: "USER_INVALID",
              message: "Gagal membuat kasir.",
            });
          }
          cashier = toUser(cashierRow);
        }

        return {
          store: toStore(store),
          owner: toUser(ownerRow),
          cashier,
        };
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        code: "USER_INVALID",
        message: "Username sudah dipakai.",
      });
    }
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
