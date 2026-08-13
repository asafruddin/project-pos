import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const LOCAL_DB_NAME = "pos-apps-local";
/** v1: PIN; v2: catalog; v3: durable sales; v4: catalog status/parent; v5: catalog image bytes; v6: parked carts; v7: void outbox; v8: customers; v9: shifts; v10: cash movements + close. */
export const LOCAL_DB_VERSION = 10;

export type PinMaterialRecord = {
  userId: string;
  pinHash: string;
  salt: string;
  enrolledAt: string;
};

/** Catalog cache row — mirrors server Product fields needed for ring-up (AD-9). */
export type CatalogProductRecord = {
  productId: string;
  name: string;
  priceMinor: number;
  stockQty: number;
  status: "active" | "inactive";
  parentId: string | null;
  sku?: string | null;
  categoryName?: string | null;
  pulledAt: string;
};

export type CatalogImageRecord = {
  productId: string;
  publicId: string;
  mimeType: string;
  bytes: ArrayBuffer;
  cachedAt: string;
};

export type LocalSaleLine = {
  productId: string;
  qty: number;
  priceMinor: number;
  name: string;
};

export type LocalSaleRecord = {
  saleId: string;
  deviceId: string;
  createdAt: string;
  completedAt?: string;
  status: "incomplete" | "complete";
  payment?: {
    method: "cash" | "store_credit" | "split";
    amountMinor: number;
    tenders?: Array<{ method: "cash" | "store_credit"; amountMinor: number }>;
  };
  lines: LocalSaleLine[];
  /** Optional Customer attach (FR-71). Sale may complete without this. */
  customerId?: string | null;
  /** Required after 2C (AD-16). */
  shiftId?: string | null;
  /** Redeem snapshot only — earn is computed after Sync (AD-14). */
  loyalty?: {
    redeemPoints: number;
    discountMinor: number;
  } | null;
  promotions?: {
    discountMinor: number;
    couponCode?: string | null;
    voucherCode?: string | null;
    voucherMinor: number;
    managerDiscountMinor: number;
    applied?: Array<{ promotionId: string; name: string; discountMinor: number }>;
  } | null;
  /** Set when Voided — status stays complete (AD-2). */
  voidedAt?: string;
  voidId?: string;
};

/** Device-local parked Cart Panel — not a Sale (AD-14 / FR-62). */
export type ParkedCartLine = {
  productId: string;
  name: string;
  priceMinor: number;
  qty: number;
};

export type ParkedCartRecord = {
  parkId: string;
  createdAt: string;
  lines: ParkedCartLine[];
  totalMinor: number;
  customerId?: string | null;
  customerName?: string | null;
};

export type CachedCustomerRecord = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  groupName: string | null;
  storeCreditMinor?: number;
  customerPrices?: Record<string, number>;
  groupPrices?: Record<string, number>;
  loyaltyPoints?: number;
  loyaltyTier?: string | null;
  loyaltyLifetimeEarned?: number;
  pulledAt: string;
};

export type CustomerCreateOutboxRecord = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  enqueuedAt: string;
};

export type LocalShiftRecord = {
  shiftId: string;
  storeId: string;
  registerId: string;
  openedAt: string;
  openingCashMinor: number;
  status: "open" | "closed";
  closedAt?: string;
  countedCashMinor?: number;
  expectedCashMinor?: number;
  differenceMinor?: number;
};

export type ShiftOutboxRecord = {
  shiftId: string;
  enqueuedAt: string;
};

export type LocalCashMovementRecord = {
  movementId: string;
  shiftId: string;
  kind: "in" | "out";
  amountMinor: number;
  reason: string;
  occurredAt: string;
};

export type CashMovementOutboxRecord = {
  movementId: string;
  enqueuedAt: string;
};

export type ShiftCloseOutboxRecord = {
  shiftId: string;
  enqueuedAt: string;
};

interface PosLocalDb extends DBSchema {
  pinMaterial: {
    key: string;
    value: PinMaterialRecord;
  };
  catalogProducts: {
    key: string;
    value: CatalogProductRecord;
  };
  catalogImages: {
    key: string;
    value: CatalogImageRecord;
  };
  meta: {
    key: string;
    value: string;
  };
  sales: {
    key: string;
    value: LocalSaleRecord;
    indexes: { status: "incomplete" | "complete" };
  };
  syncOutbox: {
    key: string;
    value: { saleId: string; enqueuedAt: string };
  };
  parkedCarts: {
    key: string;
    value: ParkedCartRecord;
  };
  voidOutbox: {
    key: string;
    value: { voidId: string; saleId: string; enqueuedAt: string };
  };
  customers: {
    key: string;
    value: CachedCustomerRecord;
  };
  customerCreateOutbox: {
    key: string;
    value: CustomerCreateOutboxRecord;
  };
  shifts: {
    key: string;
    value: LocalShiftRecord;
  };
  shiftOutbox: {
    key: string;
    value: ShiftOutboxRecord;
  };
  cashMovements: {
    key: string;
    value: LocalCashMovementRecord;
  };
  cashMovementOutbox: {
    key: string;
    value: CashMovementOutboxRecord;
  };
  shiftCloseOutbox: {
    key: string;
    value: ShiftCloseOutboxRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<PosLocalDb>> | null = null;

export function openLocalDb(): Promise<IDBPDatabase<PosLocalDb>> {
  if (!dbPromise) {
    dbPromise = openDB<PosLocalDb>(LOCAL_DB_NAME, LOCAL_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("pinMaterial")) {
            db.createObjectStore("pinMaterial", { keyPath: "userId" });
          }
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta");
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("catalogProducts")) {
            db.createObjectStore("catalogProducts", { keyPath: "productId" });
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains("sales")) {
            const store = db.createObjectStore("sales", { keyPath: "saleId" });
            store.createIndex("status", "status");
          }
          if (!db.objectStoreNames.contains("syncOutbox")) {
            db.createObjectStore("syncOutbox", { keyPath: "saleId" });
          }
        }
        if (oldVersion < 4) {
          /* catalog rows gain status/parentId on next replaceCatalog */
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains("catalogImages")) {
            db.createObjectStore("catalogImages", { keyPath: "productId" });
          }
        }
        if (oldVersion < 6) {
          if (!db.objectStoreNames.contains("parkedCarts")) {
            db.createObjectStore("parkedCarts", { keyPath: "parkId" });
          }
        }
        if (oldVersion < 7) {
          if (!db.objectStoreNames.contains("voidOutbox")) {
            db.createObjectStore("voidOutbox", { keyPath: "voidId" });
          }
        }
        if (oldVersion < 8) {
          if (!db.objectStoreNames.contains("customers")) {
            db.createObjectStore("customers", { keyPath: "customerId" });
          }
          if (!db.objectStoreNames.contains("customerCreateOutbox")) {
            db.createObjectStore("customerCreateOutbox", { keyPath: "customerId" });
          }
        }
        if (oldVersion < 9) {
          if (!db.objectStoreNames.contains("shifts")) {
            db.createObjectStore("shifts", { keyPath: "shiftId" });
          }
          if (!db.objectStoreNames.contains("shiftOutbox")) {
            db.createObjectStore("shiftOutbox", { keyPath: "shiftId" });
          }
        }
        if (oldVersion < 10) {
          if (!db.objectStoreNames.contains("cashMovements")) {
            db.createObjectStore("cashMovements", { keyPath: "movementId" });
          }
          if (!db.objectStoreNames.contains("cashMovementOutbox")) {
            db.createObjectStore("cashMovementOutbox", {
              keyPath: "movementId",
            });
          }
          if (!db.objectStoreNames.contains("shiftCloseOutbox")) {
            db.createObjectStore("shiftCloseOutbox", { keyPath: "shiftId" });
          }
        }
      },
    });
  }
  return dbPromise;
}

/** Test helper — resets the cached open promise (does not delete IndexedDB). */
export function resetLocalDbCache(): void {
  dbPromise = null;
}
