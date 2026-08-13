import type { LoyaltyProgram } from "@pos-apps/types";
import { openLocalDb } from "./db.js";

const META_LOYALTY_PROGRAM = "loyaltyProgram";

export async function getLoyaltyProgram(): Promise<LoyaltyProgram | null> {
  const db = await openLocalDb();
  const raw = await db.get("meta", META_LOYALTY_PROGRAM);
  if (typeof raw !== "string" || !raw) return null;
  try {
    const row = JSON.parse(raw) as LoyaltyProgram;
    if (!row || typeof row !== "object" || typeof row.program_id !== "string") {
      return null;
    }
    return row;
  } catch {
    return null;
  }
}

/** Last successful pull wins. Failed pulls must not clear the cache (AD-18). */
export async function replaceLoyaltyProgram(
  program: LoyaltyProgram,
): Promise<void> {
  const db = await openLocalDb();
  await db.put("meta", JSON.stringify(program), META_LOYALTY_PROGRAM);
}
