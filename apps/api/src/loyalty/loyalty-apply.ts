import {
  evaluateLoyaltyEarn,
  evaluateLoyaltyRedeem,
  normalizeLoyaltyProgram,
  resolveLoyaltyTier,
  type LoyaltyProgramSnapshot,
} from "@pos-apps/domain";
import { LOYALTY_PROGRAM_1_ID } from "@pos-apps/types";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  loyaltyAccounts,
  loyaltyLedger,
  loyaltyPrograms,
} from "../db/schema";

type LedgerTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

export function programFromRow(
  row: typeof loyaltyPrograms.$inferSelect | undefined,
): LoyaltyProgramSnapshot | null {
  if (!row) return null;
  return normalizeLoyaltyProgram({
    enabled: row.enabled,
    earn_per_minor: row.earnPerMinor,
    point_value_minor: row.pointValueMinor,
    expire_days: row.expireDays,
    tiers: row.tiers ?? [],
  });
}

export async function loadLoyaltyProgram(
  tx: LedgerTx,
): Promise<LoyaltyProgramSnapshot | null> {
  const rows = await tx
    .select()
    .from(loyaltyPrograms)
    .where(eq(loyaltyPrograms.programId, LOYALTY_PROGRAM_1_ID))
    .limit(1);
  return programFromRow(rows[0]);
}

async function ensureAccount(
  tx: LedgerTx,
  customerId: string,
): Promise<typeof loyaltyAccounts.$inferSelect> {
  const existing = await tx
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.customerId, customerId))
    .for("update")
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await tx
    .insert(loyaltyAccounts)
    .values({
      customerId,
      pointsBalance: 0,
      lifetimeEarned: 0,
      tier: "Reguler",
    })
    .returning();
  return created!;
}

export async function unexpiredBalance(
  tx: LedgerTx,
  customerId: string,
  now: Date = new Date(),
): Promise<number> {
  const rows = await tx
    .select({ remaining: loyaltyLedger.remainingPoints })
    .from(loyaltyLedger)
    .where(
      and(
        eq(loyaltyLedger.customerId, customerId),
        eq(loyaltyLedger.kind, "earn"),
        gt(loyaltyLedger.remainingPoints, 0),
        or(isNull(loyaltyLedger.expiresAt), gt(loyaltyLedger.expiresAt, now)),
      ),
    );
  return rows.reduce((sum, row) => sum + (row.remaining ?? 0), 0);
}

async function consumeFifo(
  tx: LedgerTx,
  customerId: string,
  points: number,
  now: Date,
): Promise<void> {
  let left = points;
  const rows = await tx
    .select()
    .from(loyaltyLedger)
    .where(
      and(
        eq(loyaltyLedger.customerId, customerId),
        eq(loyaltyLedger.kind, "earn"),
        gt(loyaltyLedger.remainingPoints, 0),
        or(isNull(loyaltyLedger.expiresAt), gt(loyaltyLedger.expiresAt, now)),
      ),
    )
    .orderBy(asc(loyaltyLedger.occurredAt));
  for (const row of rows) {
    if (left <= 0) break;
    const take = Math.min(row.remainingPoints ?? 0, left);
    await tx
      .update(loyaltyLedger)
      .set({ remainingPoints: (row.remainingPoints ?? 0) - take })
      .where(eq(loyaltyLedger.entryId, row.entryId));
    left -= take;
  }
}

async function restoreFifo(
  tx: LedgerTx,
  customerId: string,
  points: number,
): Promise<void> {
  let left = points;
  const rows = await tx
    .select()
    .from(loyaltyLedger)
    .where(
      and(
        eq(loyaltyLedger.customerId, customerId),
        eq(loyaltyLedger.kind, "earn"),
      ),
    )
    .orderBy(asc(loyaltyLedger.occurredAt));
  for (const row of rows) {
    if (left <= 0) break;
    const room = Math.max(0, row.pointsDelta - (row.remainingPoints ?? 0));
    const give = Math.min(room, left);
    if (give <= 0) continue;
    await tx
      .update(loyaltyLedger)
      .set({ remainingPoints: (row.remainingPoints ?? 0) + give })
      .where(eq(loyaltyLedger.entryId, row.entryId));
    left -= give;
  }
}

export async function applySaleLoyalty(
  tx: LedgerTx,
  input: {
    customerId: string | null;
    saleId: string;
    amountMinor: number;
    redeemPoints: number;
    payableMinor: number;
    actorId?: string | null;
  },
): Promise<{
  redeem_points: number;
  discount_minor: number;
  earned_points: number;
}> {
  const empty = { redeem_points: 0, discount_minor: 0, earned_points: 0 };
  if (!input.customerId) return empty;

  const program = await loadLoyaltyProgram(tx);
  const now = new Date();
  let redeem_points = 0;
  let discount_minor = 0;
  let earned_points = 0;

  if (input.redeemPoints > 0) {
    const balance = await unexpiredBalance(tx, input.customerId, now);
    const redeemed = evaluateLoyaltyRedeem({
      program,
      points_balance: balance,
      redeem_points: input.redeemPoints,
      payable_minor: input.payableMinor,
    });
    if (redeemed.ok && !redeemed.skipped && redeemed.redeem_points > 0) {
      const account = await ensureAccount(tx, input.customerId);
      redeem_points = redeemed.redeem_points;
      discount_minor = redeemed.discount_minor;
      await consumeFifo(tx, input.customerId, redeem_points, now);
      await tx.insert(loyaltyLedger).values({
        customerId: input.customerId,
        kind: "redeem",
        pointsDelta: -redeem_points,
        saleId: input.saleId,
        actorId: input.actorId ?? null,
        note: "redeem penjualan",
        occurredAt: now,
      });
      await tx
        .update(loyaltyAccounts)
        .set({
          pointsBalance: Math.max(0, account.pointsBalance - redeem_points),
          updatedAt: now,
        })
        .where(eq(loyaltyAccounts.customerId, input.customerId));
    }
  }

  const earned = evaluateLoyaltyEarn({
    program,
    amount_minor: Math.max(0, input.amountMinor),
    lifetime_points: 0,
  });
  if (!earned.skipped && earned.points > 0) {
    const account = await ensureAccount(tx, input.customerId);
    const withTier = evaluateLoyaltyEarn({
      program,
      amount_minor: Math.max(0, input.amountMinor),
      lifetime_points: account.lifetimeEarned,
    });
    earned_points = withTier.points;
    const expiresAt =
      program?.expire_days != null
        ? new Date(now.getTime() + program.expire_days * 24 * 60 * 60 * 1000)
        : null;
    await tx.insert(loyaltyLedger).values({
      customerId: input.customerId,
      kind: "earn",
      pointsDelta: earned_points,
      remainingPoints: earned_points,
      expiresAt,
      saleId: input.saleId,
      actorId: input.actorId ?? null,
      note: "earn penjualan",
      occurredAt: now,
    });
    const nextLifetime = account.lifetimeEarned + earned_points;
    await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: Math.max(0, account.pointsBalance + earned_points),
        lifetimeEarned: nextLifetime,
        tier: resolveLoyaltyTier(nextLifetime, program?.tiers),
        updatedAt: now,
      })
      .where(eq(loyaltyAccounts.customerId, input.customerId));
  }

  return { redeem_points, discount_minor, earned_points };
}

export async function applyVoidLoyalty(
  tx: LedgerTx,
  input: { customerId: string | null; saleId: string; actorId?: string | null },
): Promise<void> {
  if (!input.customerId) return;
  const now = new Date();
  const rows = await tx
    .select()
    .from(loyaltyLedger)
    .where(
      and(
        eq(loyaltyLedger.saleId, input.saleId),
        eq(loyaltyLedger.customerId, input.customerId),
      ),
    );
  if (rows.some((row) => row.kind === "void_earn" || row.kind === "void_redeem")) {
    return;
  }

  let delta = 0;
  let lifetimeDelta = 0;
  for (const row of rows) {
    if (row.kind === "earn") {
      delta -= row.pointsDelta;
      lifetimeDelta -= row.pointsDelta;
      await tx.insert(loyaltyLedger).values({
        customerId: input.customerId,
        kind: "void_earn",
        pointsDelta: -row.pointsDelta,
        saleId: input.saleId,
        actorId: input.actorId ?? null,
        note: "void earn",
        occurredAt: now,
      });
      if (row.remainingPoints != null) {
        await tx
          .update(loyaltyLedger)
          .set({ remainingPoints: 0 })
          .where(eq(loyaltyLedger.entryId, row.entryId));
      }
    }
    if (row.kind === "redeem") {
      delta += -row.pointsDelta;
      await restoreFifo(tx, input.customerId, -row.pointsDelta);
      await tx.insert(loyaltyLedger).values({
        customerId: input.customerId,
        kind: "void_redeem",
        pointsDelta: -row.pointsDelta,
        saleId: input.saleId,
        actorId: input.actorId ?? null,
        note: "void redeem",
        occurredAt: now,
      });
    }
  }
  if (!delta && !lifetimeDelta) return;
  const account = await ensureAccount(tx, input.customerId);
  const program = await loadLoyaltyProgram(tx);
  const nextLifetime = Math.max(0, account.lifetimeEarned + lifetimeDelta);
  await tx
    .update(loyaltyAccounts)
    .set({
      pointsBalance: Math.max(0, account.pointsBalance + delta),
      lifetimeEarned: nextLifetime,
      tier: resolveLoyaltyTier(nextLifetime, program?.tiers),
      updatedAt: now,
    })
    .where(eq(loyaltyAccounts.customerId, input.customerId));
}
