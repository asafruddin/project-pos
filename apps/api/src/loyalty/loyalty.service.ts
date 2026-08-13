import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { normalizeLoyaltyProgram, grantsFor, hasPermission } from "@pos-apps/domain";
import type {
  LoyaltyAccount,
  LoyaltyProgram,
  Role,
  UpdateLoyaltyProgramRequest,
} from "@pos-apps/types";
import { LOYALTY_PROGRAM_1_ID } from "@pos-apps/types";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { loyaltyAccounts, loyaltyLedger, loyaltyPrograms } from "../db/schema";
import { programFromRow } from "./loyalty-apply";

function mapProgram(row: typeof loyaltyPrograms.$inferSelect): LoyaltyProgram {
  const parsed = programFromRow(row);
  return {
    program_id: row.programId,
    enabled: parsed?.enabled ?? row.enabled,
    earn_per_minor: parsed?.earn_per_minor ?? row.earnPerMinor,
    point_value_minor: parsed?.point_value_minor ?? row.pointValueMinor,
    expire_days: parsed?.expire_days ?? row.expireDays,
    tiers: parsed?.tiers ?? [],
    updated_at: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class LoyaltyService {
  async getProgram(): Promise<LoyaltyProgram> {
    const rows = await getDb()
      .select()
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.programId, LOYALTY_PROGRAM_1_ID))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "LOYALTY_UNAVAILABLE",
        message: "Program loyalitas belum siap.",
      });
    }
    return mapProgram(rows[0]);
  }

  async updateProgram(
    input: UpdateLoyaltyProgramRequest,
    actor: { role: Role; permissions?: string[] },
  ): Promise<LoyaltyProgram> {
    if (!hasPermission(grantsFor(actor), "loyalty", "update")) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Kasir tidak dapat mengubah aturan loyalitas.",
      });
    }
    const current = await this.getProgram();
    const parsed = normalizeLoyaltyProgram({
      enabled: input.enabled ?? current.enabled,
      earn_per_minor: input.earn_per_minor ?? current.earn_per_minor,
      point_value_minor: input.point_value_minor ?? current.point_value_minor,
      expire_days:
        input.expire_days === undefined ? current.expire_days : input.expire_days,
      tiers: input.tiers ?? current.tiers,
    });
    if (!parsed) {
      throw new BadRequestException({
        code: "LOYALTY_INVALID",
        message: "Aturan loyalitas tidak valid.",
      });
    }
    const [row] = await getDb()
      .update(loyaltyPrograms)
      .set({
        enabled: parsed.enabled,
        earnPerMinor: parsed.earn_per_minor,
        pointValueMinor: parsed.point_value_minor,
        expireDays: parsed.expire_days,
        tiers: parsed.tiers,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyPrograms.programId, LOYALTY_PROGRAM_1_ID))
      .returning();
    if (!row) {
      throw new NotFoundException({
        code: "LOYALTY_UNAVAILABLE",
        message: "Program loyalitas belum siap.",
      });
    }
    return mapProgram(row);
  }

  async getAccount(customerId: string): Promise<LoyaltyAccount> {
    const db = getDb();
    const accountRows = await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.customerId, customerId))
      .limit(1);
    const ledgerRows = await db
      .select()
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.customerId, customerId))
      .orderBy(desc(loyaltyLedger.occurredAt));
    const account = accountRows[0];
    return {
      customer_id: customerId,
      points_balance: account?.pointsBalance ?? 0,
      lifetime_earned: account?.lifetimeEarned ?? 0,
      tier: account?.tier ?? null,
      ledger: ledgerRows.map((row) => ({
        entry_id: row.entryId,
        customer_id: row.customerId,
        kind: row.kind,
        points_delta: row.pointsDelta,
        sale_id: row.saleId,
        note: row.note,
        occurred_at: row.occurredAt.toISOString(),
      })),
    };
  }
}
