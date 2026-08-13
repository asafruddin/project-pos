import { evaluateCustomerProfile } from "@pos-apps/domain";
import type { CreateCustomerRequest, Customer } from "@pos-apps/types";
import {
  openLocalDb,
  type CachedCustomerRecord,
  type CustomerCreateOutboxRecord,
} from "./db.js";

export type { CachedCustomerRecord, CustomerCreateOutboxRecord };

export type CustomerCacheStore = {
  list(): Promise<CachedCustomerRecord[]>;
  put(row: CachedCustomerRecord): Promise<void>;
  delete(customerId: string): Promise<void>;
  get(customerId: string): Promise<CachedCustomerRecord | undefined>;
};

export type CustomerCreateOutboxStore = {
  list(): Promise<CustomerCreateOutboxRecord[]>;
  put(row: CustomerCreateOutboxRecord): Promise<void>;
  delete(customerId: string): Promise<void>;
};

export function customerFromApi(
  row: Customer,
  pulledAt: string = new Date().toISOString(),
): CachedCustomerRecord {
  return {
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    groupName: row.group_name,
    storeCreditMinor: row.store_credit_minor ?? 0,
    customerPrices: Object.fromEntries(
      (row.price_overrides ?? []).map((entry) => [
        entry.product_id,
        entry.price_minor,
      ]),
    ),
    groupPrices: Object.fromEntries(
      (row.group_price_overrides ?? []).map((entry) => [
        entry.product_id,
        entry.price_minor,
      ]),
    ),
    loyaltyPoints: row.loyalty_points ?? 0,
    loyaltyTier: row.loyalty_tier ?? null,
    loyaltyLifetimeEarned: row.loyalty_lifetime_earned ?? 0,
    pulledAt,
  };
}

export function matchCustomers(
  rows: CachedCustomerRecord[],
  q: string,
): CachedCustomerRecord[] {
  const term = q.trim().toLowerCase();
  if (!term) {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }
  return rows
    .filter((row) => {
      const hay = [row.name, row.phone ?? "", row.email ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Merge server pull with unsynced local creates so queued profiles stay attachable.
 */
export async function replaceCustomersIn(
  cache: CustomerCacheStore,
  outbox: CustomerCreateOutboxStore,
  incoming: CachedCustomerRecord[],
): Promise<void> {
  const pending = await outbox.list();
  const pendingIds = new Set(pending.map((row) => row.customerId));
  const existing = await cache.list();
  const next = new Map<string, CachedCustomerRecord>();
  for (const row of incoming) next.set(row.customerId, row);
  for (const row of existing) {
    if (pendingIds.has(row.customerId) && !next.has(row.customerId)) {
      next.set(row.customerId, row);
    }
  }
  const nextIds = new Set(next.keys());
  for (const row of existing) {
    if (!nextIds.has(row.customerId)) await cache.delete(row.customerId);
  }
  for (const row of next.values()) await cache.put(row);
}

export async function queueCustomerCreateIn(
  cache: CustomerCacheStore,
  outbox: CustomerCreateOutboxStore,
  input: CreateCustomerRequest,
  now: string = new Date().toISOString(),
): Promise<CachedCustomerRecord> {
  const parsed = evaluateCustomerProfile(input);
  if (!parsed.ok) throw new Error(parsed.code);
  const customerId = input.customer_id ?? crypto.randomUUID();
  const record: CachedCustomerRecord = {
    customerId,
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email,
    notes: parsed.notes,
    groupName: parsed.group_name,
    storeCreditMinor: 0,
    customerPrices: {},
    groupPrices: {},
    loyaltyPoints: 0,
    loyaltyTier: null,
    loyaltyLifetimeEarned: 0,
    pulledAt: now,
  };
  await cache.put(record);
  await outbox.put({
    customerId,
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email,
    notes: parsed.notes,
    enqueuedAt: now,
  });
  return record;
}

export function toCreateCustomerRequest(
  row: CustomerCreateOutboxRecord,
): CreateCustomerRequest {
  return {
    customer_id: row.customerId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
  };
}

async function deviceCache(): Promise<CustomerCacheStore> {
  const db = await openLocalDb();
  return {
    async list() {
      return db.getAll("customers");
    },
    async put(row) {
      await db.put("customers", row);
    },
    async delete(customerId) {
      await db.delete("customers", customerId);
    },
    async get(customerId) {
      return db.get("customers", customerId);
    },
  };
}

async function deviceOutbox(): Promise<CustomerCreateOutboxStore> {
  const db = await openLocalDb();
  return {
    async list() {
      return db.getAll("customerCreateOutbox");
    },
    async put(row) {
      await db.put("customerCreateOutbox", row);
    },
    async delete(customerId) {
      await db.delete("customerCreateOutbox", customerId);
    },
  };
}

export async function listCachedCustomers(): Promise<CachedCustomerRecord[]> {
  const rows = await (await deviceCache()).list();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCachedCustomer(
  customerId: string,
): Promise<CachedCustomerRecord | undefined> {
  return (await deviceCache()).get(customerId);
}

export async function replaceCustomers(
  incoming: CachedCustomerRecord[],
): Promise<void> {
  await replaceCustomersIn(await deviceCache(), await deviceOutbox(), incoming);
}

export async function queueCustomerCreate(
  input: CreateCustomerRequest,
): Promise<CachedCustomerRecord> {
  return queueCustomerCreateIn(await deviceCache(), await deviceOutbox(), input);
}

export async function listPendingCustomerCreates(): Promise<
  CustomerCreateOutboxRecord[]
> {
  return (await deviceOutbox()).list();
}

export async function markCustomerCreateSynced(customerId: string): Promise<void> {
  await (await deviceOutbox()).delete(customerId);
}
