import { openLocalDb, type ParkedCartLine, type ParkedCartRecord } from "./db.js";

export type { ParkedCartLine, ParkedCartRecord };

export type ParkedCartStore = {
  put(row: ParkedCartRecord): Promise<void>;
  get(parkId: string): Promise<ParkedCartRecord | undefined>;
  delete(parkId: string): Promise<void>;
  list(): Promise<ParkedCartRecord[]>;
};

export type BuildParkResult =
  | { ok: true; record: ParkedCartRecord }
  | { ok: false; code: "PARK_EMPTY" | "PARK_INVALID_LINE" };

/**
 * Snapshot a Cart Panel. Not a Sale — no status, no saleId, no outbox (AD-14).
 */
export function buildParkedCart(
  lines: ParkedCartLine[],
  opts?: {
    parkId?: string;
    createdAt?: string;
    customerId?: string | null;
    customerName?: string | null;
  },
): BuildParkResult {
  if (!lines.length) return { ok: false, code: "PARK_EMPTY" };
  const seen = new Set<string>();
  let totalMinor = 0;
  const snapshot: ParkedCartLine[] = [];
  for (const line of lines) {
    const name = line.name.trim();
    if (!line.productId || !name) return { ok: false, code: "PARK_INVALID_LINE" };
    if (seen.has(line.productId)) return { ok: false, code: "PARK_INVALID_LINE" };
    seen.add(line.productId);
    if (!Number.isInteger(line.qty) || line.qty < 1) {
      return { ok: false, code: "PARK_INVALID_LINE" };
    }
    if (!Number.isInteger(line.priceMinor) || line.priceMinor < 0) {
      return { ok: false, code: "PARK_INVALID_LINE" };
    }
    snapshot.push({
      productId: line.productId,
      name,
      priceMinor: line.priceMinor,
      qty: line.qty,
    });
    totalMinor += line.priceMinor * line.qty;
  }
  return {
    ok: true,
    record: {
      parkId: opts?.parkId ?? crypto.randomUUID(),
      createdAt: opts?.createdAt ?? new Date().toISOString(),
      lines: snapshot,
      totalMinor,
      customerId: opts?.customerId ?? null,
      customerName: opts?.customerName ?? null,
    },
  };
}

export async function parkCartIn(
  store: ParkedCartStore,
  lines: ParkedCartLine[],
  opts?: { customerId?: string | null; customerName?: string | null },
): Promise<ParkedCartRecord> {
  const built = buildParkedCart(lines, opts);
  if (!built.ok) throw new Error(built.code);
  await store.put(built.record);
  return built.record;
}

export async function getParkedCartIn(
  store: ParkedCartStore,
  parkId: string,
): Promise<ParkedCartRecord> {
  const row = await store.get(parkId);
  if (!row) throw new Error("PARK_NOT_FOUND");
  return row;
}

export async function resumeParkedCartIn(
  store: ParkedCartStore,
  parkId: string,
): Promise<ParkedCartRecord> {
  const row = await getParkedCartIn(store, parkId);
  await store.delete(parkId);
  return row;
}

export async function discardParkedCartIn(
  store: ParkedCartStore,
  parkId: string,
): Promise<void> {
  await store.delete(parkId);
}

export async function listParkedCartsIn(
  store: ParkedCartStore,
): Promise<ParkedCartRecord[]> {
  const rows = await store.list();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

async function deviceParkedStore(): Promise<ParkedCartStore> {
  const db = await openLocalDb();
  return {
    async put(row) {
      await db.put("parkedCarts", row);
    },
    async get(parkId) {
      return db.get("parkedCarts", parkId);
    },
    async delete(parkId) {
      await db.delete("parkedCarts", parkId);
    },
    async list() {
      return db.getAll("parkedCarts");
    },
  };
}

export async function parkCart(
  lines: ParkedCartLine[],
  opts?: { customerId?: string | null; customerName?: string | null },
): Promise<ParkedCartRecord> {
  return parkCartIn(await deviceParkedStore(), lines, opts);
}

export async function getParkedCart(parkId: string): Promise<ParkedCartRecord> {
  return getParkedCartIn(await deviceParkedStore(), parkId);
}

export async function resumeParkedCart(parkId: string): Promise<ParkedCartRecord> {
  return resumeParkedCartIn(await deviceParkedStore(), parkId);
}

export async function discardParkedCart(parkId: string): Promise<void> {
  return discardParkedCartIn(await deviceParkedStore(), parkId);
}

export async function listParkedCarts(): Promise<ParkedCartRecord[]> {
  return listParkedCartsIn(await deviceParkedStore());
}
