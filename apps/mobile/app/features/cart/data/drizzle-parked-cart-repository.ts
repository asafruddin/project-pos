import { desc, eq } from "drizzle-orm";
import { parkedCarts } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { ParkedCart, ParkedCartLine, ParkedCartRepository } from "../domain/parked-cart";

function toDomain(r: typeof parkedCarts.$inferSelect): ParkedCart {
  let lines: ParkedCartLine[] = [];
  try {
    lines = JSON.parse(r.linesJson) as ParkedCartLine[];
  } catch {
    /* corrupt row shows as empty and can be discarded */
  }
  return { parkId: r.parkId, createdAt: r.createdAt, lines, totalMinor: r.totalMinor, customerName: r.customerName };
}

export class DrizzleParkedCartRepository implements ParkedCartRepository {
  constructor(private readonly db: AppDb) {}

  save(cart: ParkedCart): void {
    this.db
      .insert(parkedCarts)
      .values({
        parkId: cart.parkId,
        createdAt: cart.createdAt,
        linesJson: JSON.stringify(cart.lines),
        totalMinor: cart.totalMinor,
        customerName: cart.customerName,
      })
      .run();
  }

  get(parkId: string): ParkedCart | null {
    const row = this.db.select().from(parkedCarts).where(eq(parkedCarts.parkId, parkId)).get();
    return row ? toDomain(row) : null;
  }

  delete(parkId: string): void {
    this.db.delete(parkedCarts).where(eq(parkedCarts.parkId, parkId)).run();
  }

  list(): ParkedCart[] {
    return this.db.select().from(parkedCarts).orderBy(desc(parkedCarts.createdAt)).all().map(toDomain);
  }
}
