import type { SyncSaleRequest } from "@pos-apps/types";
import { openLocalDb, type LocalSaleLine, type LocalSaleRecord } from "./db.js";

const DEVICE_ID_KEY = "deviceId";

export type CreateIncompleteSaleInput = {
  lines: LocalSaleLine[];
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
  payment: { method: "cash"; amountMinor: number },
): Promise<LocalSaleRecord> {
  if (!Number.isInteger(payment.amountMinor) || payment.amountMinor < 0) {
    throw new Error("Invalid payment amount");
  }
  const db = await openLocalDb();
  const tx = db.transaction(["sales", "syncOutbox", "catalogProducts"], "readwrite");
  const sale = await tx.objectStore("sales").get(saleId);
  if (!sale) throw new Error("Sale not found");
  if (sale.status === "complete") {
    await tx.done;
    return sale;
  }
  const catalog = tx.objectStore("catalogProducts");
  for (const line of sale.lines) {
    const product = await catalog.get(line.productId);
    if (!product || product.stockQty < line.qty) {
      throw new Error("Insufficient local stock");
    }
    await catalog.put({ ...product, stockQty: product.stockQty - line.qty });
  }
  const completedAt = new Date().toISOString();
  const completed: LocalSaleRecord = {
    ...sale,
    status: "complete",
    completedAt,
    payment,
  };
  await tx.objectStore("sales").put(completed);
  await tx.objectStore("syncOutbox").put({
    saleId,
    enqueuedAt: completedAt,
  });
  await tx.done;
  return completed;
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

export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfLocalDay(d: Date = new Date()): Date {
  const start = startOfLocalDay(d);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

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

export type DayCloseSummary = {
  sales: LocalSaleRecord[];
  totalMinor: number;
  cashMinor: number;
  transactionCount: number;
  pendingSyncSaleIds: string[];
  pendingSyncCount: number;
};

export async function getDayCloseSummary(
  day: Date = new Date(),
): Promise<DayCloseSummary> {
  const sales = await listCompleteSalesForLocalDay(day);
  const pending = await listPendingSyncSales();
  const pendingIds = new Set(pending.map((s) => s.saleId));
  const pendingSyncSaleIds = sales
    .filter((s) => pendingIds.has(s.saleId))
    .map((s) => s.saleId);
  const totalMinor = sales.reduce(
    (sum, sale) => sum + (sale.payment?.amountMinor ?? 0),
    0,
  );
  return {
    sales,
    totalMinor,
    cashMinor: totalMinor, // Phase 1: cash-only payments
    transactionCount: sales.length,
    pendingSyncSaleIds,
    pendingSyncCount: pendingSyncSaleIds.length,
  };
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
    },
    lines: sale.lines.map((line) => ({
      product_id: line.productId,
      qty: line.qty,
      price_minor: line.priceMinor,
    })),
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
