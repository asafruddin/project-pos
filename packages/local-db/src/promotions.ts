import type { Promotion } from "@pos-apps/types";
import { openLocalDb } from "./db.js";

const META_PROMOTIONS = "promotions";

export async function getCachedPromotions(): Promise<Promotion[]> {
  const db = await openLocalDb();
  const raw = await db.get("meta", META_PROMOTIONS);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as { promotions?: Promotion[] };
    return Array.isArray(parsed.promotions) ? parsed.promotions : [];
  } catch {
    return [];
  }
}

/** Last successful pull wins. Failed pulls must not clear the cache (AD-18). */
export async function replacePromotions(promotions: Promotion[]): Promise<void> {
  const db = await openLocalDb();
  await db.put("meta", JSON.stringify({ promotions }), META_PROMOTIONS);
}
