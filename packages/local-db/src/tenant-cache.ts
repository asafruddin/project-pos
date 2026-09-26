import { openLocalDb } from "./db.js";

const META_TENANT_STORE_ID = "tenantStoreId";
const META_CATALOG_PULLED_AT = "catalogPulledAt";
const META_PROMOTIONS = "promotions";
const META_LOYALTY_PROGRAM = "loyaltyProgram";

export async function getCachedTenantStoreId(): Promise<string | null> {
  const db = await openLocalDb();
  return (await db.get("meta", META_TENANT_STORE_ID)) ?? null;
}

/**
 * When the cashier session store changes, drop catalog/customer caches so
 * Store B cannot sell leftover Store #1 SKUs on a shared device.
 */
export async function adoptTenantStoreId(storeId: string): Promise<boolean> {
  const current = await getCachedTenantStoreId();
  if (current && current !== storeId) {
    await clearStoreScopedCaches();
    const db = await openLocalDb();
    await db.put("meta", storeId, META_TENANT_STORE_ID);
    return true;
  }
  if (current !== storeId) {
    const db = await openLocalDb();
    await db.put("meta", storeId, META_TENANT_STORE_ID);
  }
  return false;
}

export async function clearStoreScopedCaches(): Promise<void> {
  const db = await openLocalDb();
  const tx = db.transaction(
    [
      "catalogProducts",
      "catalogImages",
      "customers",
      "customerCreateOutbox",
      "parkedCarts",
      "meta",
    ],
    "readwrite",
  );
  await tx.objectStore("catalogProducts").clear();
  await tx.objectStore("catalogImages").clear();
  await tx.objectStore("customers").clear();
  await tx.objectStore("customerCreateOutbox").clear();
  await tx.objectStore("parkedCarts").clear();
  await tx.objectStore("meta").delete(META_CATALOG_PULLED_AT);
  await tx.objectStore("meta").delete(META_PROMOTIONS);
  await tx.objectStore("meta").delete(META_LOYALTY_PROGRAM);
  await tx.done;
}
