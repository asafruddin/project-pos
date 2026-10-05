import { asc, notInArray } from "drizzle-orm";
import { customers } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import { insertOutbox, type OutboxRepository } from "@/infrastructure/sync/outbox";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { CreateCustomerRequest } from "@pos-apps/types";
import type { Customer } from "../domain/customer";
import type { CustomerRepository } from "../domain/ports";

function toDomain(r: typeof customers.$inferSelect): Customer {
  const { pulledAt: _pulledAt, ...rest } = r;
  return rest;
}

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(
    private readonly db: AppDb,
    private readonly outbox: OutboxRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  list(): Customer[] {
    return this.db.select().from(customers).orderBy(asc(customers.name)).all().map(toDomain);
  }

  get(customerId: string): Customer | null {
    return this.list().find((c) => c.customerId === customerId) ?? null;
  }

  replaceAll(rows: Customer[], pulledAtIso: string): void {
    // A customer created offline may not be on the server yet: never drop it from the cache.
    const queued = [...this.outbox.unsyncedEntityIds(["customer.create"])];
    this.db.transaction((tx) => {
      if (queued.length > 0) tx.delete(customers).where(notInArray(customers.customerId, queued)).run();
      else tx.delete(customers).run();
      for (const c of rows) {
        const { customerId, ...fields } = c;
        tx.insert(customers)
          .values({ customerId, ...fields, pulledAt: pulledAtIso })
          .onConflictDoUpdate({ target: customers.customerId, set: { ...fields, pulledAt: pulledAtIso } })
          .run();
      }
    });
  }

  createLocal(request: CreateCustomerRequest & { customer_id: string }, customer: Customer, pulledAtIso: string): void {
    this.db.transaction((tx) => {
      tx.insert(customers).values({ ...customer, pulledAt: pulledAtIso }).onConflictDoNothing().run();
      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "customer.create",
        entityId: customer.customerId,
        payload: request,
        createdAt: this.clock.nowMs(),
      });
    });
  }
}
