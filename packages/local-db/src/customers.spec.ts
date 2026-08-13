import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  customerFromApi,
  matchCustomers,
  queueCustomerCreateIn,
  replaceCustomersIn,
  toCreateCustomerRequest,
  type CachedCustomerRecord,
  type CustomerCacheStore,
  type CustomerCreateOutboxRecord,
  type CustomerCreateOutboxStore,
} from "./customers";

function memoryCache(seed: CachedCustomerRecord[] = []): CustomerCacheStore & {
  rows: Map<string, CachedCustomerRecord>;
} {
  const rows = new Map(seed.map((row) => [row.customerId, row]));
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async put(row) {
      rows.set(row.customerId, row);
    },
    async delete(customerId) {
      rows.delete(customerId);
    },
    async get(customerId) {
      return rows.get(customerId);
    },
  };
}

function memoryOutbox(
  seed: CustomerCreateOutboxRecord[] = [],
): CustomerCreateOutboxStore & { rows: Map<string, CustomerCreateOutboxRecord> } {
  const rows = new Map(seed.map((row) => [row.customerId, row]));
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async put(row) {
      rows.set(row.customerId, row);
    },
    async delete(customerId) {
      rows.delete(customerId);
    },
  };
}

describe("matchCustomers", () => {
  const sari: CachedCustomerRecord = {
    customerId: "c1",
    name: "Sari",
    phone: "0812",
    email: null,
    notes: null,
    groupName: "Regular",
    pulledAt: "2026-08-13T00:00:00.000Z",
  };

  it("filters by name or phone and sorts", () => {
    const budi: CachedCustomerRecord = { ...sari, customerId: "c2", name: "Budi", phone: "0899" };
    assert.equal(matchCustomers([sari, budi], "sari")[0]?.customerId, "c1");
    assert.equal(matchCustomers([sari, budi], "0812")[0]?.customerId, "c1");
  });

  it("maps store credit and price overrides from the API", () => {
    const row = customerFromApi({
      customer_id: "c1",
      name: "Sari",
      phone: "0812",
      email: null,
      notes: null,
      group_name: "Regular",
      store_credit_minor: 15000,
      price_overrides: [{ product_id: "p1", price_minor: 7000 }],
      group_price_overrides: [{ product_id: "p1", price_minor: 8000 }],
      loyalty_points: 40,
      loyalty_tier: "Reguler",
      loyalty_lifetime_earned: 40,
      created_at: "2026-08-13T00:00:00.000Z",
      updated_at: "2026-08-13T00:00:00.000Z",
    });
    assert.equal(row.storeCreditMinor, 15000);
    assert.equal(row.customerPrices?.p1, 7000);
    assert.equal(row.groupPrices?.p1, 8000);
    assert.equal(row.loyaltyPoints, 40);
    assert.equal(row.loyaltyTier, "Reguler");
  });
});

describe("queueCustomerCreateIn", () => {
  it("writes cache and customer_create outbox without a Sale", async () => {
    const cache = memoryCache();
    const outbox = memoryOutbox();
    const row = await queueCustomerCreateIn(cache, outbox, {
      customer_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Sari",
      phone: "0812",
    });
    assert.equal(row.customerId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(outbox.rows.size, 1);
    assert.deepEqual(toCreateCustomerRequest([...outbox.rows.values()][0]!), {
      customer_id: row.customerId,
      name: "Sari",
      phone: "0812",
      email: null,
      notes: null,
    });
  });

  it("rejects missing contact", async () => {
    await assert.rejects(
      () => queueCustomerCreateIn(memoryCache(), memoryOutbox(), { name: "Sari" }),
      /CUSTOMER_CONTACT_REQUIRED/,
    );
  });
});

describe("replaceCustomersIn", () => {
  it("keeps queued local creates that the server does not have yet", async () => {
    const queued: CachedCustomerRecord = {
      customerId: "local-1",
      name: "Baru",
      phone: "0800",
      email: null,
      notes: null,
      groupName: null,
      pulledAt: "2026-08-13T00:00:00.000Z",
    };
    const cache = memoryCache([queued]);
    const outbox = memoryOutbox([
      {
        customerId: "local-1",
        name: "Baru",
        phone: "0800",
        email: null,
        notes: null,
        enqueuedAt: "2026-08-13T00:00:00.000Z",
      },
    ]);
    await replaceCustomersIn(cache, outbox, [
      {
        customerId: "server-1",
        name: "Sari",
        phone: "0812",
        email: null,
        notes: null,
        groupName: null,
        pulledAt: "2026-08-13T01:00:00.000Z",
      },
    ]);
    const ids = [...cache.rows.keys()].sort();
    assert.deepEqual(ids, ["local-1", "server-1"]);
  });
});

describe("customer_create isolation (AD-14)", () => {
  it("never mentions sales outbox, ledger, or Cloudinary", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "customers.ts"),
      "utf8",
    );
    assert.equal(
      /syncOutbox|completeSale|insertStockMovement|cloudinary|shift_id/.test(src),
      false,
    );
  });
});
