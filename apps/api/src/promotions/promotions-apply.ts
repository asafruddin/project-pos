import {
  evaluatePromotions,
  evaluateVoucher,
  normalizePromotion,
  type PromotionSnapshot,
} from "@pos-apps/domain";
import { and, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { promotions, vouchers } from "../db/schema";

type LedgerTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

export function promotionFromRow(
  row: typeof promotions.$inferSelect,
): PromotionSnapshot | null {
  return normalizePromotion({
    promotion_id: row.promotionId,
    name: row.name,
    enabled: row.enabled,
    kind: row.kind,
    percent_bps: row.percentBps,
    fixed_minor: row.fixedMinor,
    coupon_code: row.couponCode,
    exclusive: row.exclusive,
    min_subtotal_minor: row.minSubtotalMinor,
    customer_group: row.customerGroup,
    product_ids: row.productIds ?? [],
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    hour_start: row.hourStart,
    hour_end: row.hourEnd,
  });
}

export async function loadPromotions(tx: LedgerTx): Promise<PromotionSnapshot[]> {
  const rows = await tx.select().from(promotions);
  return rows
    .map(promotionFromRow)
    .filter((row): row is PromotionSnapshot => row != null);
}

export async function applySaleVoucher(
  tx: LedgerTx,
  input: {
    voucherCode: string | null;
    payableMinor: number;
  },
): Promise<{ voucher_minor: number; voucher_code: string | null }> {
  const code = input.voucherCode?.trim().toUpperCase() ?? "";
  if (!code) return { voucher_minor: 0, voucher_code: null };
  const rows = await tx
    .select()
    .from(vouchers)
    .where(eq(vouchers.code, code))
    .for("update")
    .limit(1);
  const row = rows[0];
  if (!row || !row.enabled) return { voucher_minor: 0, voucher_code: null };
  const applied = evaluateVoucher({
    remaining_minor: row.remainingMinor,
    payable_minor: input.payableMinor,
  });
  if (applied.skipped || applied.applied_minor < 1) {
    return { voucher_minor: 0, voucher_code: null };
  }
  await tx
    .update(vouchers)
    .set({
      remainingMinor: applied.remaining_minor,
      updatedAt: new Date(),
    })
    .where(eq(vouchers.voucherId, row.voucherId));
  return { voucher_minor: applied.applied_minor, voucher_code: code };
}

export async function restoreSaleVoucher(
  tx: LedgerTx,
  input: { voucherCode: string | null; voucherMinor: number },
): Promise<void> {
  const code = input.voucherCode?.trim().toUpperCase() ?? "";
  if (!code || !Number.isInteger(input.voucherMinor) || input.voucherMinor < 1) {
    return;
  }
  await tx
    .update(vouchers)
    .set({
      remainingMinor: sql`${vouchers.remainingMinor} + ${input.voucherMinor}`,
      updatedAt: new Date(),
    })
    .where(and(eq(vouchers.code, code)));
}

export { evaluatePromotions };
