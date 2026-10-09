import { DEFAULT_MANAGER_PIN, type ManagerPinMaterial } from "@pos-apps/types";
import { openLocalDb, type PinMaterialRecord } from "./db.js";
import {
  createSalt,
  hashPin,
  isSixDigitPin,
  timingSafeEqual,
} from "./pin-hash.js";

export type { PinMaterialRecord };

export const MANAGER_PIN_USER_ID = "__manager__";

export async function getPinMaterial(
  userId: string,
): Promise<PinMaterialRecord | null> {
  const db = await openLocalDb();
  return (await db.get("pinMaterial", userId)) ?? null;
}

export async function getAnyPinMaterial(): Promise<PinMaterialRecord | null> {
  const db = await openLocalDb();
  const all = await db.getAll("pinMaterial");
  return all.find((row) => row.userId !== MANAGER_PIN_USER_ID) ?? null;
}

export async function hasPinMaterial(userId?: string): Promise<boolean> {
  if (userId) {
    return (await getPinMaterial(userId)) !== null;
  }
  return (await getAnyPinMaterial()) !== null;
}

/**
 * Enroll a 6-digit PIN for userId after online Account Login.
 * Overwrites existing material for that user (re-enrollment).
 */
export async function enrollPin(
  userId: string,
  pin: string,
): Promise<PinMaterialRecord> {
  if (!userId) throw new Error("PIN_USER_REQUIRED");
  if (!isSixDigitPin(pin)) throw new Error("PIN_INVALID_FORMAT");
  const salt = createSalt();
  const pinHash = await hashPin(pin, salt);
  const record: PinMaterialRecord = {
    userId,
    pinHash,
    salt,
    enrolledAt: new Date().toISOString(),
  };
  const db = await openLocalDb();
  await db.put("pinMaterial", record);
  return record;
}

export async function verifyPin(
  userId: string | null,
  pin: string,
): Promise<boolean> {
  if (!isSixDigitPin(pin)) return false;
  const material = userId
    ? await getPinMaterial(userId)
    : await getAnyPinMaterial();
  if (!material) return false;
  const candidate = await hashPin(pin, material.salt);
  return timingSafeEqual(candidate, material.pinHash);
}

/**
 * Cache the store's manager PIN (from login / `/auth/me`) for offline voids.
 * `null` means the owner has no custom PIN: the default applies, so any old material is dropped.
 */
export async function syncManagerPin(
  material: ManagerPinMaterial | null | undefined,
): Promise<void> {
  if (material === undefined) return;
  const db = await openLocalDb();
  if (!material) {
    await db.delete("pinMaterial", MANAGER_PIN_USER_ID);
    return;
  }
  await db.put("pinMaterial", {
    userId: MANAGER_PIN_USER_ID,
    pinHash: material.hash,
    salt: material.salt,
    enrolledAt: new Date().toISOString(),
  });
}

/** Pure check: the synced material, or the default PIN when the owner never set one. */
export async function matchesManagerPin(
  material: Pick<PinMaterialRecord, "pinHash" | "salt"> | null,
  pin: string,
): Promise<boolean> {
  if (!isSixDigitPin(pin)) return false;
  if (!material) return pin === DEFAULT_MANAGER_PIN;
  return timingSafeEqual(await hashPin(pin, material.salt), material.pinHash);
}

export async function verifyManagerPin(pin: string): Promise<boolean> {
  return matchesManagerPin(await getPinMaterial(MANAGER_PIN_USER_ID), pin);
}

export async function clearPinMaterial(userId?: string): Promise<void> {
  const db = await openLocalDb();
  if (userId) {
    await db.delete("pinMaterial", userId);
    return;
  }
  await db.clear("pinMaterial");
}
