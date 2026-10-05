import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { catalogProducts, saleLines, sales } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { KvStore } from "@/infrastructure/db/kv-store";
import { insertOutbox, type OutboxRepository } from "@/infrastructure/sync/outbox";
import { endOfLocalDay, startOfLocalDay } from "@/utils/day";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import { AppError } from "@/core/errors/app-error";
import type { CashSaleView } from "@/features/shift/domain/shift";
import type { DeviceIdProvider, SalesRepository } from "../domain/ports";
import type { CompletedSale, SalePromotions, SaleTender } from "../domain/sale";
import { toSyncSaleRequest, toSyncVoidRequest } from "../domain/sale-sync-mapper";

const DEVICE_ID_KEY = "device.id";

export class KvDeviceIdProvider implements DeviceIdProvider {
  constructor(
    private readonly kv: KvStore,
    private readonly ids: IdGenerator,
  ) {}

  getDeviceId(): string {
    const existing = this.kv.get(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = this.ids.uuid();
    this.kv.set(DEVICE_ID_KEY, id);
    return id;
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class DrizzleSalesRepository implements SalesRepository {
  constructor(
    private readonly db: AppDb,
    private readonly outbox: OutboxRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  recordCompletedSale(sale: CompletedSale): void {
    this.db.transaction((tx) => {
      const inserted = tx
        .insert(sales)
        .values({
          saleId: sale.saleId,
          deviceId: sale.deviceId,
          createdAt: sale.createdAt,
          completedAt: sale.completedAt,
          paymentMethod: sale.payment.method,
          paymentAmountMinor: sale.payment.amountMinor,
          tendersJson: JSON.stringify(sale.payment.tenders),
          promotionsJson: sale.promotions ? JSON.stringify(sale.promotions) : null,
          customerId: sale.customerId,
          guestName: sale.guestName,
          shiftId: sale.shiftId,
        })
        .onConflictDoNothing()
        .run();
      // Replaying the same saleId must not double-count stock or double-queue.
      if (inserted.changes === 0) return;

      tx.insert(saleLines)
        .values(sale.lines.map((l) => ({ ...l, saleId: sale.saleId })))
        .run();

      // Optimistic local stock; the next catalog pull (after the outbox drains) is authoritative.
      for (const line of sale.lines) {
        tx.update(catalogProducts)
          .set({ stockQty: sql`max(0, ${catalogProducts.stockQty} - ${line.qty})` })
          .where(and(eq(catalogProducts.productId, line.productId), eq(catalogProducts.trackStock, true)))
          .run();
      }

      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "sale.sync",
        entityId: sale.saleId,
        payload: toSyncSaleRequest(sale),
        createdAt: this.clock.nowMs(),
      });
    });
  }

  getSale(saleId: string): CompletedSale | null {
    const row = this.db.select().from(sales).where(eq(sales.saleId, saleId)).get();
    return row ? this.hydrate([row])[0] : null;
  }

  listForLocalDay(day: Date): CompletedSale[] {
    const rows = this.db
      .select()
      .from(sales)
      .where(and(gte(sales.completedAt, startOfLocalDay(day).toISOString()), lt(sales.completedAt, endOfLocalDay(day).toISOString())))
      .orderBy(desc(sales.completedAt))
      .all();
    return this.hydrate(rows);
  }

  listCashViews(): CashSaleView[] {
    return this.db
      .select()
      .from(sales)
      .all()
      .map((r) => ({
        shiftId: r.shiftId,
        paymentMethod: r.paymentMethod,
        amountMinor: r.paymentAmountMinor,
        tenders: parse<SaleTender[]>(r.tendersJson, []),
        voidedAt: r.voidedAt,
      }));
  }

  voidSale(input: { saleId: string; voidId: string; voidedAt: string }): CompletedSale {
    this.db.transaction((tx) => {
      const existing = tx.select().from(sales).where(eq(sales.saleId, input.saleId)).get();
      if (!existing) throw new AppError("VALIDATION", "VOID_NOT_FOUND");
      if (existing.voidedAt) throw new AppError("VALIDATION", "VOID_NOT_ALLOWED");
      tx.update(sales).set({ voidedAt: input.voidedAt, voidId: input.voidId }).where(eq(sales.saleId, input.saleId)).run();
      const lines = tx.select().from(saleLines).where(eq(saleLines.saleId, input.saleId)).all();
      for (const line of lines) {
        tx.update(catalogProducts)
          .set({ stockQty: sql`${catalogProducts.stockQty} + ${line.qty}` })
          .where(and(eq(catalogProducts.productId, line.productId), eq(catalogProducts.trackStock, true)))
          .run();
      }
      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "sale.void",
        entityId: input.saleId,
        payload: toSyncVoidRequest({ voidId: input.voidId, saleId: input.saleId, voidedAt: input.voidedAt }),
        createdAt: this.clock.nowMs(),
      });
    });
    return this.getSale(input.saleId)!;
  }

  unsyncedSaleIds(): Set<string> {
    return this.outbox.unsyncedEntityIds(["sale.sync", "sale.void"]);
  }

  private hydrate(rows: (typeof sales.$inferSelect)[]): CompletedSale[] {
    if (rows.length === 0) return [];
    const lines = this.db
      .select()
      .from(saleLines)
      .where(
        inArray(
          saleLines.saleId,
          rows.map((r) => r.saleId),
        ),
      )
      .all();
    return rows.map((r) => ({
      saleId: r.saleId,
      deviceId: r.deviceId,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      lines: lines
        .filter((l) => l.saleId === r.saleId)
        .map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, priceMinor: l.priceMinor })),
      payment: {
        method: r.paymentMethod as CompletedSale["payment"]["method"],
        amountMinor: r.paymentAmountMinor,
        tenders: parse<SaleTender[]>(r.tendersJson, []),
      },
      promotions: parse<SalePromotions | null>(r.promotionsJson, null),
      customerId: r.customerId,
      guestName: r.guestName,
      shiftId: r.shiftId ?? "",
      voidedAt: r.voidedAt,
      voidId: r.voidId,
    }));
  }
}
