import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const LOCAL_DB_NAME = "pos-apps-local";
/** v1: PIN; v2: catalog; v3: durable sales and sync outbox. */
export const LOCAL_DB_VERSION = 3;

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
  pulledAt: string;
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
  payment?: { method: "cash"; amountMinor: number };
  lines: LocalSaleLine[];
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
      },
    });
  }
  return dbPromise;
}

/** Test helper — resets the cached open promise (does not delete IndexedDB). */
export function resetLocalDbCache(): void {
  dbPromise = null;
}
