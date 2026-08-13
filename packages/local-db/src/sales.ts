import {
  evaluateSplitTender,
  stackSaleDiscounts,
  storeCreditTenderTotal,
  tendersFromPayment,
} from "@pos-apps/domain";
import type { SyncSaleRequest, SyncVoidRequest } from "@pos-apps/types";
import { openLocalDb, type LocalSaleLine, type LocalSaleRecord } from "./db.js";
import { endOfLocalDay, startOfLocalDay } from "./day-bounds.js";
import { evaluateVoid } from "./void-sale.js";

const DEVICE_ID_KEY = "deviceId";

export type CreateIncompleteSaleInput = {
  lines: LocalSaleLine[];
  customerId?: string | null;
};

export async function getDeviceId(): Promise<string> {
  const db = await openLocalDb();
  const existing = await db.get("meta", DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  await db.put("meta", deviceId, DEVICE_ID_KEY);
  return deviceId;
}

export async function createIncompleteSale(
  input: CreateIncompleteSaleInput,
): Promise<LocalSaleRecord> {
  validateLines(input.lines);
  const sale: LocalSaleRecord = {
    saleId: crypto.randomUUID(),
    deviceId: await getDeviceId(),
    createdAt: new Date().toISOString(),
    status: "incomplete",
    lines: input.lines,
    customerId: input.customerId ?? null,
  };
  const db = await openLocalDb();
  await db.put("sales", sale);
  return sale;
}

/** Discard an in-progress Sale (Receipt cancelled) — must not Sync or touch Stock. */
export async function discardIncompleteSale(saleId: string): Promise<void> {
  const db = await openLocalDb();
  const sale = await db.get("sales", saleId);
  if (!sale) return;
  if (sale.status === "complete") {
    throw new Error("Cannot discard a complete sale");
  }
  await db.delete("sales", saleId);
}

/** Receipt confirmation is the only transition to complete and queues sync atomically. */
export async function completeSale(
  saleId: string,
  payment: {
    method?: "cash" | "store_credit" | "split";
    amountMinor?: number;
    tenders?: Array<{ method: "cash" | "store_credit"; amountMinor: number }>;
  },
  loyalty?: { redeemPoints?: number; discountMinor?: number } | null,
  promotions?: {
    discountMinor?: number;
    couponCode?: string | null;
    voucherCode?: string | null;
    voucherMinor?: number;
    managerDiscountMinor?: number;
    applied?: Array<{ promotionId: string; name: string; discountMinor: number }>;
  } | null,
): Promise<LocalSaleRecord> {
  const db = await openLocalDb();
  const tx = db.transaction(
    ["sales", "syncOutbox", "catalogProducts", "shifts", "customers"],
    "readwrite",
  );
  const sale = await tx.objectStore("sales").get(saleId);
  if (!sale) throw new Error("Sale not found");
  if (sale.status === "complete") {
    await tx.done;
    return sale;
  }
  const openShiftRow = (await tx.objectStore("shifts").getAll()).find(
    (row) => row.status === "open",
  );
  if (!openShiftRow) throw new Error("SHIFT_REQUIRED");

  const lineTotal = sale.lines.reduce(
    (sum, line) => sum + line.priceMinor * line.qty,
    0,
  );
  const redeemPoints = loyalty?.redeemPoints ?? 0;
  const loyaltyDiscount = loyalty?.discountMinor ?? 0;
  const promoDiscount = promotions?.discountMinor ?? 0;
  const voucherMinor = promotions?.voucherMinor ?? 0;
  const managerDiscount = promotions?.managerDiscountMinor ?? 0;
  if (
    !Number.isInteger(redeemPoints) ||
    redeemPoints < 0 ||
    !Number.isInteger(loyaltyDiscount) ||
    loyaltyDiscount < 0 ||
    (loyaltyDiscount > 0 && redeemPoints < 1) ||
    !Number.isInteger(promoDiscount) ||
    promoDiscount < 0 ||
    !Number.isInteger(voucherMinor) ||
    voucherMinor < 0 ||
    !Number.isInteger(managerDiscount) ||
    managerDiscount < 0
  ) {
    throw new Error("LOYALTY_INVALID");
  }
  const payable = stackSaleDiscounts({
    line_total_minor: lineTotal,
    promo_discount_minor: promoDiscount,
    manager_discount_minor: managerDiscount,
    voucher_minor: voucherMinor,
    loyalty_discount_minor: loyaltyDiscount,
  });
  const tenders = (payment.tenders ?? []).map((row) => ({
    method: row.method,
    amount_minor: row.amountMinor,
  }));
  const snapshot = tenders.length
    ? { tenders, amount_minor: payable, method: payment.method }
    : {
        method: payment.method ?? "cash",
        amount_minor: payment.amountMinor ?? payable,
      };
  let storeCreditBalance: number | undefined;
  const customerId = sale.customerId ?? null;
  if (customerId) {
    const customer = await tx.objectStore("customers").get(customerId);
    storeCreditBalance = Number.isInteger(customer?.storeCreditMinor)
      ? customer!.storeCreditMinor
      : 0;
  }
  const parsed = evaluateSplitTender({
    payable_minor: payable,
    customer_id: customerId,
    ...(typeof storeCreditBalance === "number"
      ? { store_credit_balance_minor: storeCreditBalance }
      : {}),
    tenders: tendersFromPayment(snapshot),
  });
  if (!parsed.ok) throw new Error(parsed.code);

  const catalog = tx.objectStore("catalogProducts");
  for (const line of sale.lines) {
    const product = await catalog.get(line.productId);
    if (!product || product.stockQty < line.qty) {
      throw new Error("Insufficient local stock");
    }
    await catalog.put({ ...product, stockQty: product.stockQty - line.qty });
  }

  if (parsed.store_credit_minor > 0) {
    if (!customerId) throw new Error("TENDER_STORE_CREDIT_REQUIRES_CUSTOMER");
    const customer = await tx.objectStore("customers").get(customerId);
    if (!customer) throw new Error("TENDER_STORE_CREDIT_REQUIRES_CUSTOMER");
    await tx.objectStore("customers").put({
      ...customer,
      storeCreditMinor:
        (Number.isInteger(customer.storeCreditMinor)
          ? customer.storeCreditMinor!
          : 0) - parsed.store_credit_minor,
      loyaltyPoints:
        redeemPoints > 0
          ? Math.max(0, (customer.loyaltyPoints ?? 0) - redeemPoints)
          : customer.loyaltyPoints,
    });
  } else if (redeemPoints > 0 && customerId) {
    const customer = await tx.objectStore("customers").get(customerId);
    if (customer) {
      await tx.objectStore("customers").put({
        ...customer,
        loyaltyPoints: Math.max(0, (customer.loyaltyPoints ?? 0) - redeemPoints),
      });
    }
  }
  const completedAt = new Date().toISOString();
  const completed: LocalSaleRecord = {
    ...sale,
    status: "complete",
    completedAt,
    payment: {
      method: parsed.method,
      amountMinor: parsed.amount_minor,
      tenders: parsed.tenders.map((row) => ({
        method: row.method,
        amountMinor: row.amount_minor,
      })),
    },
    shiftId: openShiftRow.shiftId,
    ...(loyaltyDiscount > 0 || redeemPoints > 0
      ? { loyalty: { redeemPoints, discountMinor: loyaltyDiscount } }
      : {}),
    ...(promoDiscount > 0 ||
    voucherMinor > 0 ||
    managerDiscount > 0 ||
    promotions?.couponCode
      ? {
          promotions: {
            discountMinor: promoDiscount,
            couponCode: promotions?.couponCode ?? null,
            voucherCode: promotions?.voucherCode ?? null,
            voucherMinor,
            managerDiscountMinor: managerDiscount,
            applied: promotions?.applied ?? [],
          },
        }
      : {}),
  };
  await tx.objectStore("sales").put(completed);
  await tx.objectStore("syncOutbox").put({
    saleId,
    enqueuedAt: completedAt,
  });
  await tx.done;
  return completed;
}

/**
 * Same-day Void of a complete Sale (AD-2 / AD-14). Does not delete the sale.
 * Restores local catalog qty and enqueues a void outbox item.
 */
export async function voidCompleteSale(
  saleId: string,
  now: Date = new Date(),
): Promise<LocalSaleRecord> {
  const db = await openLocalDb();
  const tx = db.transaction(
    ["sales", "voidOutbox", "catalogProducts", "customers"],
    "readwrite",
  );
  const sale = await tx.objectStore("sales").get(saleId);
  if (!sale) throw new Error("VOID_NOT_FOUND");
  const evaluated = evaluateVoid(sale, now);
  if (!evaluated.ok) throw new Error(evaluated.code);
  const voidId = crypto.randomUUID();
  const voidedAt = now.toISOString();
  const voided: LocalSaleRecord = { ...sale, voidedAt, voidId };
  await tx.objectStore("sales").put(voided);
  const catalog = tx.objectStore("catalogProducts");
  const seen = new Map<string, number>();
  for (const line of sale.lines) {
    const product = await catalog.get(line.productId);
    if (!product) continue;
    const current = seen.get(line.productId) ?? product.stockQty;
    const next = current + line.qty;
    seen.set(line.productId, next);
    await catalog.put({ ...product, stockQty: next });
  }
  const credit = storeCreditTenderTotal({
    method: sale.payment?.method,
    amount_minor: sale.payment?.amountMinor,
    tenders: sale.payment?.tenders?.map((row) => ({
      method: row.method,
      amount_minor: row.amountMinor,
    })),
  });
  if (credit > 0 && sale.customerId) {
    const customer = await tx.objectStore("customers").get(sale.customerId);
    if (customer) {
      const current = Number.isInteger(customer.storeCreditMinor)
        ? customer.storeCreditMinor!
        : 0;
      await tx.objectStore("customers").put({
        ...customer,
        storeCreditMinor: current + credit,
        loyaltyPoints:
          (customer.loyaltyPoints ?? 0) + (sale.loyalty?.redeemPoints ?? 0),
      });
    }
  } else if ((sale.loyalty?.redeemPoints ?? 0) > 0 && sale.customerId) {
    const customer = await tx.objectStore("customers").get(sale.customerId);
    if (customer) {
      await tx.objectStore("customers").put({
        ...customer,
        loyaltyPoints:
          (customer.loyaltyPoints ?? 0) + (sale.loyalty?.redeemPoints ?? 0),
      });
    }
  }
  await tx.objectStore("voidOutbox").put({
    voidId,
    saleId,
    enqueuedAt: voidedAt,
  });
  await tx.done;
  return voided;
}

export async function listPendingSyncVoids(): Promise<
  Array<{ voidId: string; saleId: string; enqueuedAt: string; sale: LocalSaleRecord }>
> {
  const db = await openLocalDb();
  const outbox = await db.getAll("voidOutbox");
  const rows = [];
  for (const item of outbox) {
    const sale = await db.get("sales", item.saleId);
    if (sale?.status === "complete" && sale.voidedAt && sale.voidId === item.voidId) {
      rows.push({ ...item, sale });
    }
  }
  return rows;
}

export async function markVoidSynced(voidId: string): Promise<void> {
  const db = await openLocalDb();
  await db.delete("voidOutbox", voidId);
}

export function toSyncVoidRequest(input: {
  voidId: string;
  saleId: string;
  voidedAt: string;
}): SyncVoidRequest {
  return {
    void_id: input.voidId,
    sale_id: input.saleId,
    voided_at: input.voidedAt,
  };
}

export async function getSale(saleId: string): Promise<LocalSaleRecord | undefined> {
  return (await openLocalDb()).get("sales", saleId);
}

export async function listPendingSyncSales(): Promise<LocalSaleRecord[]> {
  const db = await openLocalDb();
  const outbox = await db.getAll("syncOutbox");
  const sales = await Promise.all(outbox.map(({ saleId }) => db.get("sales", saleId)));
  return sales.filter((sale): sale is LocalSaleRecord => sale?.status === "complete");
}

export async function markSaleSynced(saleId: string): Promise<void> {
  const db = await openLocalDb();
  await db.delete("syncOutbox", saleId);
}

/** Brownfield: complete Sales from before 6.2 get the current open Shift at flush. */
export async function stampSaleShiftIfMissing(
  saleId: string,
  shiftId: string,
): Promise<void> {
  const db = await openLocalDb();
  const sale = await db.get("sales", saleId);
  if (!sale || sale.shiftId || sale.status !== "complete") return;
  await db.put("sales", { ...sale, shiftId });
}

export { endOfLocalDay, startOfLocalDay } from "./day-bounds.js";

/** Complete Sales for the device-local calendar day (by completedAt). */
export async function listCompleteSalesForLocalDay(
  day: Date = new Date(),
): Promise<LocalSaleRecord[]> {
  const db = await openLocalDb();
  const all = await db.getAll("sales");
  const start = startOfLocalDay(day).getTime();
  const end = endOfLocalDay(day).getTime();
  return all
    .filter(
      (sale) =>
        sale.status === "complete" &&
        !!sale.completedAt &&
        (() => {
          const t = Date.parse(sale.completedAt!);
          return Number.isFinite(t) && t >= start && t < end;
        })(),
    )
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
}

export function toSyncSaleRequest(sale: LocalSaleRecord): SyncSaleRequest {
  if (
    sale.status !== "complete" ||
    !sale.completedAt ||
    !sale.payment
  ) {
    throw new Error("Only completed sales can sync");
  }
  return {
    sale_id: sale.saleId,
    device_id: sale.deviceId,
    completed_at: sale.completedAt,
    payment: {
      method: sale.payment.method,
      amount_minor: sale.payment.amountMinor,
      ...(sale.payment.tenders?.length
        ? {
            tenders: sale.payment.tenders.map((row) => ({
              method: row.method,
              amount_minor: row.amountMinor,
            })),
          }
        : {}),
    },
    lines: sale.lines.map((line) => ({
      product_id: line.productId,
      qty: line.qty,
      price_minor: line.priceMinor,
    })),
    ...(sale.customerId ? { customer_id: sale.customerId } : {}),
    ...(sale.shiftId ? { shift_id: sale.shiftId } : {}),
    ...(sale.loyalty &&
    (sale.loyalty.redeemPoints > 0 || sale.loyalty.discountMinor > 0)
      ? {
          loyalty: {
            redeem_points: sale.loyalty.redeemPoints,
            discount_minor: sale.loyalty.discountMinor,
          },
        }
      : {}),
    ...(sale.promotions &&
    (sale.promotions.discountMinor > 0 ||
      sale.promotions.voucherMinor > 0 ||
      sale.promotions.managerDiscountMinor > 0 ||
      sale.promotions.couponCode)
      ? {
          promotions: {
            discount_minor: sale.promotions.discountMinor,
            coupon_code: sale.promotions.couponCode ?? null,
            voucher_code: sale.promotions.voucherCode ?? null,
            voucher_minor: sale.promotions.voucherMinor,
            manager_discount_minor: sale.promotions.managerDiscountMinor,
            applied: (sale.promotions.applied ?? []).map((row) => ({
              promotion_id: row.promotionId,
              name: row.name,
              discount_minor: row.discountMinor,
            })),
          },
        }
      : {}),
  };
}

function validateLines(lines: LocalSaleLine[]): void {
  if (!lines.length) throw new Error("Cannot create an empty sale");
  for (const line of lines) {
    if (
      !line.productId ||
      !Number.isInteger(line.qty) ||
      line.qty <= 0 ||
      !Number.isInteger(line.priceMinor) ||
      line.priceMinor < 0
    ) {
      throw new Error("Invalid sale line");
    }
  }
}
