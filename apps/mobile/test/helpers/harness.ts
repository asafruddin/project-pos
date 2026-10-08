import type { Voucher } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import { DrizzleCatalogRepository } from "@/features/catalog/data/drizzle-catalog-repository";
import type { CatalogProduct } from "@/features/catalog/domain/product";
import { KvQueueSettingsStore } from "@/features/queue/data/kv-queue-settings-store";
import { DrizzleSalesRepository, KvDeviceIdProvider } from "@/features/checkout/data/drizzle-sales-repository";
import { CompleteSaleUseCase } from "@/features/checkout/domain/complete-sale";
import { VoidSaleUseCase } from "@/features/checkout/domain/void-sale";
import { DrizzleCustomerRepository } from "@/features/customers/data/drizzle-customer-repository";
import { CreateCustomerUseCase } from "@/features/customers/domain/use-cases";
import {
  PinService,
  type LockoutState,
  type LockoutStore,
  type PinHasher,
  type PinMaterial,
  type PinMaterialStore,
} from "@/features/pin/domain/pin-service";
import { KvPromotionRepository } from "@/features/promotions/data/kv-promotion-repository";
import { DrizzleShiftRepository } from "@/features/shift/data/drizzle-shift-repository";
import { DayCloseSummaryUseCase } from "@/features/shift/domain/day-close-use-case";
import { CloseShiftUseCase, OpenShiftUseCase, RecordCashMovementUseCase, ShiftSummaryUseCase } from "@/features/shift/domain/use-cases";
import { DrizzleKvStore } from "@/infrastructure/db/kv-store";
import { OutboxRepository } from "@/infrastructure/sync/outbox";
import { createTestDb, fakeClock, sequentialIds } from "./test-db";

export const product = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  productId: "p1",
  name: "Kopi",
  priceMinor: 15000,
  stockQty: 10,
  status: "active",
  parentId: null,
  sku: null,
  categoryName: null,
  unitName: null,
  unitConversion: null,
  trackStock: true,
  ...over,
});

/** Fast, deterministic stand-ins for the Keystore/PBKDF2 pieces. */
export class MemoryPinStore implements PinMaterialStore {
  private rows = new Map<string, PinMaterial>();
  async get(scope: string) {
    return this.rows.get(scope) ?? null;
  }
  async set(scope: string, material: PinMaterial) {
    this.rows.set(scope, material);
  }
  async anyUser() {
    for (const [scope, m] of this.rows) if (scope !== "__manager__") return m;
    return null;
  }
  async remove(scope: string) {
    this.rows.delete(scope);
  }
}

export class MemoryLockoutStore implements LockoutStore {
  private rows = new Map<string, LockoutState>();
  get(scope: string) {
    return this.rows.get(scope) ?? { failures: 0, lockedUntil: 0 };
  }
  set(scope: string, state: LockoutState) {
    this.rows.set(scope, state);
  }
}

export const fakeHasher: PinHasher = {
  defaultIterations: 1,
  salt: () => "c2FsdA==",
  hash: async (pin, salt, iterations) => `${salt}:${iterations}:${pin}`,
};

export type HarnessOptions = {
  online?: boolean;
  permissions?: string[];
  vouchers?: Record<string, Voucher>;
};

/** The whole offline write path wired against real SQLite + the real migrations. */
export function createHarness(opts: HarnessOptions = {}) {
  const db = createTestDb();
  const clock = fakeClock();
  const ids = sequentialIds();
  const kv = new DrizzleKvStore(db);
  const queueSettings = new KvQueueSettingsStore(kv);
  const outbox = new OutboxRepository(db);
  const catalog = new DrizzleCatalogRepository(db, kv);
  const shifts = new DrizzleShiftRepository(db, outbox, clock, ids);
  const sales = new DrizzleSalesRepository(db, outbox, clock, ids);
  const customers = new DrizzleCustomerRepository(db, outbox, clock, ids);
  const promotions = new KvPromotionRepository(kv);
  const pins = new PinService(new MemoryPinStore(), fakeHasher, new MemoryLockoutStore(), clock);

  const state = { online: opts.online ?? true, queued: 0, permissions: opts.permissions ?? [] };
  const onQueued = () => void (state.queued += 1);

  const vouchers = {
    async lookup(code: string): Promise<Voucher> {
      const row = opts.vouchers?.[code.trim().toUpperCase()];
      if (!row) throw new AppError("API", "not found", { status: 404 });
      return row;
    },
  };
  const remoteStub = {
    async cashRefundsMinor() {
      return 0;
    },
  };

  const openShift = new OpenShiftUseCase(shifts, clock, ids, () => null, onQueued);
  const recordCash = new RecordCashMovementUseCase(shifts, clock, ids, onQueued);
  const summary = new ShiftSummaryUseCase(shifts, sales, remoteStub, () => state.online);
  const closeShift = new CloseShiftUseCase(shifts, summary, clock, onQueued);
  const completeSale = new CompleteSaleUseCase(
    sales,
    shifts,
    promotions,
    vouchers,
    pins,
    clock,
    ids,
    new KvDeviceIdProvider(kv, ids),
    () => state.online,
    onQueued,
    queueSettings,
  );
  const voidSale = new VoidSaleUseCase(sales, pins, clock, ids, () => state.permissions, () => "user-1", onQueued);
  const dayClose = new DayCloseSummaryUseCase(sales, shifts);
  const createCustomer = new CreateCustomerUseCase(
    customers,
    {
      async fetchAll() {
        return [];
      },
      async history() {
        throw new Error("unused");
      },
      async create() {
        return { duplicatePhone: false };
      },
    },
    clock,
    ids,
    () => state.online,
    onQueued,
  );

  return {
    db,
    clock,
    ids,
    kv,
    queueSettings,
    state,
    outbox,
    catalog,
    shifts,
    sales,
    customers,
    promotions,
    pins,
    openShift,
    recordCash,
    summary,
    closeShift,
    completeSale,
    voidSale,
    dayClose,
    createCustomer,
  };
}

export type Harness = ReturnType<typeof createHarness>;

/** Drain every queued outbox row in order and return kinds + entity ids. */
export function drainOutbox(outbox: OutboxRepository): { kind: string; entityId: string; payload: unknown }[] {
  const out: { kind: string; entityId: string; payload: unknown }[] = [];
  for (;;) {
    const row = outbox.nextPending();
    if (!row) return out;
    out.push({ kind: row.kind, entityId: row.entityId, payload: row.payload });
    outbox.markDone(row.id);
  }
}
