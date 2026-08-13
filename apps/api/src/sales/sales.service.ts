import { BadRequestException, Injectable } from "@nestjs/common";
import {
  acceptCompleteSale,
  evaluateSplitTender,
  postVoid,
  requireSaleShift,
  stackSaleDiscounts,
  storeCreditTenderTotal,
  tendersFromPayment,
} from "@pos-apps/domain";
import type {
  SalesListItem,
  SalesListResponse,
  SyncSaleRequest,
  SyncSaleResponse,
  SyncVoidRequest,
  SyncVoidResponse,
} from "@pos-apps/types";
import { REGISTER_1_ID, STORE_1_ID } from "@pos-apps/types";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import { applySaleLoyalty, applyVoidLoyalty } from "../loyalty/loyalty-apply";
import { applySaleVoucher, restoreSaleVoucher } from "../promotions/promotions-apply";
import { customers, products, registers, sales, saleReturns, saleVoids } from "../db/schema";

@Injectable()
export class SalesService {
  async listToday(): Promise<SalesListResponse> {
    const db = getDb();
    const start = startOfUtcDay(new Date());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const rows = await db
      .select({
        saleId: sales.saleId,
        completedAt: sales.completedAt,
        amountMinor: sales.amountMinor,
        voidedAt: saleVoids.voidedAt,
      })
      .from(sales)
      .leftJoin(saleVoids, eq(saleVoids.saleId, sales.saleId))
      .where(and(gte(sales.completedAt, start), lt(sales.completedAt, end)))
      .orderBy(desc(sales.completedAt));

    const items: SalesListItem[] = rows.map((r) => ({
      sale_id: r.saleId,
      completed_at: r.completedAt.toISOString(),
      amount_minor: r.amountMinor,
      voided_at: r.voidedAt ? r.voidedAt.toISOString() : null,
    }));

    const daily_total_minor = items
      .filter((s) => !s.voided_at)
      .reduce((sum, s) => sum + s.amount_minor, 0);

    return { sales: items, daily_total_minor };
  }

  async acceptSync(
    request: SyncSaleRequest,
    actorId?: string,
    storeId?: string,
  ): Promise<SyncSaleResponse> {
    validateSyncRequest(request);
    const db = getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ saleId: sales.saleId })
        .from(sales)
        .where(eq(sales.saleId, request.sale_id))
        .limit(1);
      if (existing.length) {
        return {
          sale_id: request.sale_id,
          accepted: true,
          already_accepted: true,
        };
      }

      const shift = requireSaleShift(request.shift_id);
      if (!shift.ok) {
        throw new BadRequestException({
          code: shift.code,
          message: shift.message,
        });
      }
      const shiftId = optionalCustomerId(shift.shift_id);
      if (!shiftId) {
        throw new BadRequestException({
          code: "SALE_SHIFT_REQUIRED",
          message: "Penjualan harus terikat pada shift terbuka.",
        });
      }

      const saleStoreId = storeId || STORE_1_ID;
      let saleRegisterId = REGISTER_1_ID;
      if (saleStoreId !== STORE_1_ID) {
        const regs = await tx
          .select({ registerId: registers.registerId })
          .from(registers)
          .where(eq(registers.storeId, saleStoreId))
          .orderBy(asc(registers.createdAt))
          .limit(1);
        if (!regs[0]) {
          throw new BadRequestException({
            code: "STORE_INVALID",
            message: "Toko kasir tidak memiliki register.",
          });
        }
        saleRegisterId = regs[0].registerId;
      }

      const lineTotal = request.lines.reduce(
        (total, line) => total + line.qty * line.price_minor,
        0,
      );
      const claimedPromo = request.promotions?.discount_minor ?? 0;
      const claimedManager = request.promotions?.manager_discount_minor ?? 0;
      const claimedVoucher = request.promotions?.voucher_minor ?? 0;
      const claimedLoyalty = request.loyalty?.discount_minor ?? 0;
      const payable = stackSaleDiscounts({
        line_total_minor: lineTotal,
        promo_discount_minor: claimedPromo,
        manager_discount_minor: claimedManager,
        voucher_minor: claimedVoucher,
        loyalty_discount_minor: claimedLoyalty,
      });
      const split = evaluateSplitTender({
        payable_minor: payable,
        customer_id: optionalCustomerId(request.customer_id),
        tenders: tendersFromPayment(request.payment),
      });
      if (!split.ok) {
        throw new BadRequestException({
          code: split.code,
          message: split.message,
        });
      }

      if (split.store_credit_minor > 0) {
        const customerId = optionalCustomerId(request.customer_id);
        if (!customerId) {
          throw new BadRequestException({
            code: "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER",
            message: "Kredit toko membutuhkan pelanggan.",
          });
        }
        const customerRows = await tx
          .select()
          .from(customers)
          .where(eq(customers.customerId, customerId))
          .for("update")
          .limit(1);
        const customer = customerRows[0];
        if (!customer) {
          throw new BadRequestException({
            code: "CUSTOMER_NOT_FOUND",
            message: "Pelanggan belum tersinkron. Coba unggah dulu.",
          });
        }
        const withBalance = evaluateSplitTender({
          payable_minor: payable,
          customer_id: customerId,
          store_credit_balance_minor: customer.storeCreditMinor,
          tenders: split.tenders,
        });
        if (!withBalance.ok) {
          throw new BadRequestException({
            code: withBalance.code,
            message: withBalance.message,
          });
        }
        await tx
          .update(customers)
          .set({
            storeCreditMinor:
              customer.storeCreditMinor - withBalance.store_credit_minor,
            updatedAt: new Date(),
          })
          .where(eq(customers.customerId, customerId));
      }

      const productIds = [...new Set(request.lines.map((line) => line.product_id))];
      const stock = await tx
        .select({
          product_id: products.productId,
          stock_qty: products.stockQty,
        })
        .from(products)
        .where(inArray(products.productId, productIds))
        .for("update");
      const accepted = acceptCompleteSale(stock, request.lines);
      if (!accepted.ok) {
        throw new BadRequestException({
          code: accepted.code,
          message: accepted.message,
        });
      }

      for (const line of request.lines) {
        await insertStockMovement(tx, {
          productId: line.product_id,
          storeId: saleStoreId,
          qtyDelta: -line.qty,
          bucket: "sellable",
          reason: "sale",
          sourceType: "sale",
          sourceId: request.sale_id,
          actorId: actorId ?? null,
        });
      }

      if (saleStoreId === STORE_1_ID) {
        for (const product of accepted.products) {
          await tx
            .update(products)
            .set({ stockQty: product.stock_qty, updatedAt: new Date() })
            .where(eq(products.productId, product.product_id));
        }
      }
      const beforeVoucher = stackSaleDiscounts({
        line_total_minor: lineTotal,
        promo_discount_minor: claimedPromo,
        manager_discount_minor: claimedManager,
      });
      await applySaleVoucher(tx, {
        voucherCode: request.promotions?.voucher_code ?? null,
        payableMinor: beforeVoucher,
      });
      const loyaltyApplied = await applySaleLoyalty(tx, {
        customerId: optionalCustomerId(request.customer_id),
        saleId: request.sale_id,
        amountMinor: split.amount_minor,
        redeemPoints: request.loyalty?.redeem_points ?? 0,
        payableMinor: stackSaleDiscounts({
          line_total_minor: lineTotal,
          promo_discount_minor: claimedPromo,
          manager_discount_minor: claimedManager,
          voucher_minor: claimedVoucher,
        }),
        actorId: actorId ?? null,
      });
      await tx.insert(sales).values({
        saleId: request.sale_id,
        deviceId: request.device_id,
        storeId: saleStoreId,
        registerId: saleRegisterId,
        completedAt: new Date(request.completed_at),
        amountMinor: split.amount_minor,
        payment: {
          method: split.method,
          amount_minor: split.amount_minor,
          tenders: split.tenders,
        },
        lines: request.lines,
        customerId: optionalCustomerId(request.customer_id),
        shiftId,
        loyalty: {
          redeem_points: loyaltyApplied.redeem_points,
          discount_minor: claimedLoyalty,
          earned_points: loyaltyApplied.earned_points,
        },
        promotions: {
          discount_minor: claimedPromo,
          coupon_code: request.promotions?.coupon_code ?? null,
          voucher_code: request.promotions?.voucher_code ?? null,
          voucher_minor: claimedVoucher,
          manager_discount_minor: claimedManager,
          applied: request.promotions?.applied ?? [],
        },
      });
      return {
        sale_id: request.sale_id,
        accepted: true,
        already_accepted: false,
      };
    });
  }

  async acceptVoid(
    request: SyncVoidRequest,
    actorId?: string,
  ): Promise<SyncVoidResponse> {
    validateVoidRequest(request);
    const db = getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(saleVoids)
        .where(eq(saleVoids.voidId, request.void_id))
        .limit(1);
      if (existing[0]) {
        return {
          void_id: request.void_id,
          sale_id: existing[0].saleId,
          accepted: true,
          already_accepted: true,
        };
      }

      const saleRows = await tx
        .select()
        .from(sales)
        .where(eq(sales.saleId, request.sale_id))
        .limit(1);
      const sale = saleRows[0];
      if (!sale) {
        throw new BadRequestException({
          code: "VOID_SALE_NOT_FOUND",
          message: "Penjualan belum tersinkron. Coba unggah dulu.",
        });
      }

      const voidedAlready = await tx
        .select({ voidId: saleVoids.voidId })
        .from(saleVoids)
        .where(eq(saleVoids.saleId, request.sale_id))
        .limit(1);
      if (voidedAlready.length) {
        throw new BadRequestException({
          code: "VOID_NOT_ALLOWED",
          message: "Penjualan ini sudah di-void.",
        });
      }

      const returnedAlready = await tx
        .select({ returnId: saleReturns.returnId })
        .from(saleReturns)
        .where(eq(saleReturns.saleId, request.sale_id))
        .limit(1);

      const parsed = postVoid({
        sale_status: "complete",
        already_voided: false,
        already_returned: returnedAlready.length > 0,
        same_calendar_day: true,
        lines: sale.lines.map((line) => ({
          product_id: line.product_id,
          qty: line.qty,
        })),
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }

      const productIds = parsed.lines.map((line) => line.product_id);
      const stock = await tx
        .select({
          productId: products.productId,
          stockQty: products.stockQty,
        })
        .from(products)
        .where(inArray(products.productId, productIds))
        .for("update");
      const byId = new Map(stock.map((row) => [row.productId, row]));

      for (const line of parsed.lines) {
        const product = byId.get(line.product_id);
        if (!product) {
          throw new BadRequestException({
            code: "VOID_INVALID",
            message: "Produk tidak ditemukan.",
          });
        }
        await insertStockMovement(tx, {
          productId: line.product_id,
          storeId: sale.storeId,
          qtyDelta: line.qty,
          bucket: "sellable",
          reason: "void penjualan",
          sourceType: "void",
          sourceId: request.void_id,
          actorId: actorId ?? null,
        });
        if (sale.storeId === STORE_1_ID) {
          await tx
            .update(products)
            .set({
              stockQty: product.stockQty + line.qty,
              updatedAt: new Date(),
            })
            .where(eq(products.productId, line.product_id));
        }
      }

      await tx.insert(saleVoids).values({
        voidId: request.void_id,
        saleId: request.sale_id,
        voidedAt: new Date(request.voided_at),
        actorId: actorId ?? null,
      });

      await applyVoidLoyalty(tx, {
        customerId: sale.customerId,
        saleId: request.sale_id,
        actorId: actorId ?? null,
      });
      await restoreSaleVoucher(tx, {
        voucherCode: sale.promotions?.voucher_code ?? null,
        voucherMinor: sale.promotions?.voucher_minor ?? 0,
      });

      const credit = storeCreditTenderTotal(sale.payment);
      if (credit > 0 && sale.customerId) {
        const customerRows = await tx
          .select()
          .from(customers)
          .where(eq(customers.customerId, sale.customerId))
          .for("update")
          .limit(1);
        const customer = customerRows[0];
        if (customer) {
          await tx
            .update(customers)
            .set({
              storeCreditMinor: customer.storeCreditMinor + credit,
              updatedAt: new Date(),
            })
            .where(eq(customers.customerId, sale.customerId));
        }
      }

      return {
        void_id: request.void_id,
        sale_id: request.sale_id,
        accepted: true,
        already_accepted: false,
      };
    });
  }
}

function validateSyncRequest(request: SyncSaleRequest): void {
  const invalid =
    !request ||
    typeof request.sale_id !== "string" ||
    !request.sale_id ||
    typeof request.device_id !== "string" ||
    !request.device_id ||
    !Number.isFinite(Date.parse(request.completed_at)) ||
    !request.lines?.length ||
    !request.payment ||
    (request.payment.method != null &&
      request.payment.method !== "cash" &&
      request.payment.method !== "store_credit" &&
      request.payment.method !== "split") ||
    !Number.isInteger(request.payment.amount_minor) ||
    request.payment.amount_minor < 0 ||
    (request.payment.method === "split" && !request.payment.tenders?.length) ||
    request.lines.some(
      (line) =>
        !Number.isInteger(line.price_minor) ||
        line.price_minor < 0 ||
        !Number.isInteger(line.qty) ||
        line.qty <= 0,
    );
  if (invalid) {
    throw new BadRequestException({
      code: "SALE_INVALID_SYNC",
      message: "Data sinkronisasi penjualan tidak valid.",
    });
  }
  const amount = request.lines.reduce(
    (total, line) => total + line.qty * line.price_minor,
    0,
  );
  const loyaltyDiscount = request.loyalty?.discount_minor ?? 0;
  const redeemPoints = request.loyalty?.redeem_points ?? 0;
  const promoDiscount = request.promotions?.discount_minor ?? 0;
  const voucherMinor = request.promotions?.voucher_minor ?? 0;
  const managerDiscount = request.promotions?.manager_discount_minor ?? 0;
  if (
    !Number.isInteger(loyaltyDiscount) ||
    loyaltyDiscount < 0 ||
    loyaltyDiscount > amount ||
    !Number.isInteger(redeemPoints) ||
    redeemPoints < 0 ||
    (loyaltyDiscount > 0 && redeemPoints < 1) ||
    !Number.isInteger(promoDiscount) ||
    promoDiscount < 0 ||
    !Number.isInteger(voucherMinor) ||
    voucherMinor < 0 ||
    !Number.isInteger(managerDiscount) ||
    managerDiscount < 0
  ) {
    throw new BadRequestException({
      code: "SALE_INVALID_SYNC",
      message: "Data diskon penjualan tidak valid.",
    });
  }
  const payable = stackSaleDiscounts({
    line_total_minor: amount,
    promo_discount_minor: promoDiscount,
    manager_discount_minor: managerDiscount,
    voucher_minor: voucherMinor,
    loyalty_discount_minor: loyaltyDiscount,
  });
  if (payable !== request.payment.amount_minor) {
    throw new BadRequestException({
      code: "SALE_INVALID_SYNC",
      message: "Jumlah pembayaran tidak cocok dengan item penjualan.",
    });
  }
}

function optionalCustomerId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function validateVoidRequest(request: SyncVoidRequest): void {
  const invalid =
    !request ||
    typeof request.void_id !== "string" ||
    !request.void_id ||
    typeof request.sale_id !== "string" ||
    !request.sale_id ||
    !Number.isFinite(Date.parse(request.voided_at));
  if (invalid) {
    throw new BadRequestException({
      code: "VOID_INVALID",
      message: "Data void tidak valid.",
    });
  }
}
