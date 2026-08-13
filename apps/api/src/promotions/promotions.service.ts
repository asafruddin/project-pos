import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { normalizePromotion, grantsFor, hasPermission } from "@pos-apps/domain";
import type {
  Promotion,
  Role,
  UpsertPromotionRequest,
  UpsertVoucherRequest,
  Voucher,
} from "@pos-apps/types";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { promotions, vouchers } from "../db/schema";
import { promotionFromRow } from "./promotions-apply";

function mapPromotion(row: typeof promotions.$inferSelect): Promotion {
  const parsed = promotionFromRow(row);
  return {
    promotion_id: row.promotionId,
    name: parsed?.name ?? row.name,
    enabled: parsed?.enabled ?? row.enabled,
    kind: parsed?.kind ?? row.kind,
    percent_bps: parsed?.percent_bps ?? row.percentBps,
    fixed_minor: parsed?.fixed_minor ?? row.fixedMinor,
    coupon_code: parsed?.coupon_code ?? row.couponCode,
    exclusive: parsed?.exclusive ?? row.exclusive,
    min_subtotal_minor: parsed?.min_subtotal_minor ?? row.minSubtotalMinor,
    customer_group: parsed?.customer_group ?? row.customerGroup,
    product_ids: parsed?.product_ids ?? row.productIds ?? [],
    starts_at: parsed?.starts_at ?? row.startsAt?.toISOString() ?? null,
    ends_at: parsed?.ends_at ?? row.endsAt?.toISOString() ?? null,
    hour_start: parsed?.hour_start ?? row.hourStart,
    hour_end: parsed?.hour_end ?? row.hourEnd,
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapVoucher(row: typeof vouchers.$inferSelect): Voucher {
  return {
    voucher_id: row.voucherId,
    code: row.code,
    remaining_minor: row.remainingMinor,
    enabled: row.enabled,
    updated_at: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PromotionsService {
  async list(): Promise<{ promotions: Promotion[] }> {
    const rows = await getDb()
      .select()
      .from(promotions)
      .orderBy(desc(promotions.updatedAt));
    return { promotions: rows.map(mapPromotion) };
  }

  async upsert(
    input: UpsertPromotionRequest,
    actor: { role: Role; permissions?: string[] },
    promotionId?: string,
  ): Promise<Promotion> {
    this.requireAdmin(actor);
    const parsed = normalizePromotion({
      promotion_id: promotionId ?? crypto.randomUUID(),
      ...input,
    });
    if (!parsed) {
      throw new BadRequestException({
        code: "PROMOTION_INVALID",
        message: "Aturan promo tidak valid.",
      });
    }
    const values = {
      name: parsed.name,
      enabled: parsed.enabled,
      kind: parsed.kind,
      percentBps: parsed.percent_bps,
      fixedMinor: parsed.fixed_minor,
      couponCode: parsed.coupon_code,
      exclusive: parsed.exclusive,
      minSubtotalMinor: parsed.min_subtotal_minor,
      customerGroup: parsed.customer_group,
      productIds: parsed.product_ids,
      startsAt: parsed.starts_at ? new Date(parsed.starts_at) : null,
      endsAt: parsed.ends_at ? new Date(parsed.ends_at) : null,
      hourStart: parsed.hour_start,
      hourEnd: parsed.hour_end,
      updatedAt: new Date(),
    };
    if (promotionId) {
      const [row] = await getDb()
        .update(promotions)
        .set(values)
        .where(eq(promotions.promotionId, promotionId))
        .returning();
      if (!row) {
        throw new NotFoundException({
          code: "PROMOTION_NOT_FOUND",
          message: "Promo tidak ditemukan.",
        });
      }
      return mapPromotion(row);
    }
    const [row] = await getDb()
      .insert(promotions)
      .values({ promotionId: parsed.promotion_id, ...values })
      .returning();
    return mapPromotion(row!);
  }

  async remove(promotionId: string, actor: { role: Role; permissions?: string[] }): Promise<void> {
    this.requireAdmin(actor);
    const deleted = await getDb()
      .delete(promotions)
      .where(eq(promotions.promotionId, promotionId))
      .returning({ promotionId: promotions.promotionId });
    if (!deleted.length) {
      throw new NotFoundException({
        code: "PROMOTION_NOT_FOUND",
        message: "Promo tidak ditemukan.",
      });
    }
  }

  async listVouchers(actor: { role: Role; permissions?: string[] }): Promise<{ vouchers: Voucher[] }> {
    this.requireAdmin(actor);
    const rows = await getDb()
      .select()
      .from(vouchers)
      .orderBy(vouchers.code);
    return { vouchers: rows.map(mapVoucher) };
  }

  async upsertVoucher(
    input: UpsertVoucherRequest,
    actor: { role: Role; permissions?: string[] },
    voucherId?: string,
  ): Promise<Voucher> {
    this.requireAdmin(actor);
    const code = input.code.trim().toUpperCase();
    if (!code || !Number.isInteger(input.remaining_minor) || input.remaining_minor < 0) {
      throw new BadRequestException({
        code: "VOUCHER_INVALID",
        message: "Voucher tidak valid.",
      });
    }
    const values = {
      code,
      remainingMinor: input.remaining_minor,
      enabled: input.enabled !== false,
      updatedAt: new Date(),
    };
    if (voucherId) {
      const [row] = await getDb()
        .update(vouchers)
        .set(values)
        .where(eq(vouchers.voucherId, voucherId))
        .returning();
      if (!row) {
        throw new NotFoundException({
          code: "VOUCHER_NOT_FOUND",
          message: "Voucher tidak ditemukan.",
        });
      }
      return mapVoucher(row);
    }
    const [row] = await getDb().insert(vouchers).values(values).returning();
    return mapVoucher(row!);
  }

  async lookupVoucher(code: string): Promise<Voucher> {
    const rows = await getDb()
      .select()
      .from(vouchers)
      .where(eq(vouchers.code, code.trim().toUpperCase()))
      .limit(1);
    if (!rows[0] || !rows[0].enabled) {
      throw new NotFoundException({
        code: "VOUCHER_NOT_FOUND",
        message: "Voucher tidak ditemukan.",
      });
    }
    return mapVoucher(rows[0]);
  }

  private requireAdmin(actor: { role: Role; permissions?: string[] }): void {
    const grants = grantsFor(actor);
    if (
      !hasPermission(grants, "promotions", "create") &&
      !hasPermission(grants, "promotions", "update") &&
      !hasPermission(grants, "promotions", "delete")
    ) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Kasir tidak dapat mengubah promo.",
      });
    }
  }
}
