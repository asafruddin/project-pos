import { evaluateCustomerProfile } from "@pos-apps/domain";
import { AppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { PullTask } from "@/infrastructure/sync/pull-task";
import type { Customer } from "./customer";
import type { CustomerRemote, CustomerRepository } from "./ports";

export type CreateCustomerInput = { name: string; phone?: string; email?: string };

/** Saved locally and queued first; if online we also try the server right away for the duplicate-phone warning. */
export class CreateCustomerUseCase {
  constructor(
    private readonly repo: CustomerRepository,
    private readonly remote: CustomerRemote,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly online: () => boolean,
    private readonly onQueued: () => void,
  ) {}

  async execute(input: CreateCustomerInput): Promise<{ customer: Customer; duplicatePhone: boolean }> {
    const parsed = evaluateCustomerProfile(input);
    if (!parsed.ok) throw new AppError("VALIDATION", parsed.code);
    const customer: Customer = {
      customerId: this.ids.uuid(),
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      notes: parsed.notes,
      groupName: parsed.group_name,
      storeCreditMinor: 0,
      loyaltyPoints: 0,
      loyaltyTier: null,
    };
    const request = {
      customer_id: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
    };
    this.repo.createLocal(request, customer, this.clock.nowIso());
    // The queued row is idempotent on customer_id, so the scheduler sending it again is harmless.
    this.onQueued();
    let duplicatePhone = false;
    if (this.online()) {
      try {
        duplicatePhone = (await this.remote.create(request)).duplicatePhone;
      } catch {
        /* stays queued */
      }
    }
    return { customer, duplicatePhone };
  }
}

export class PullCustomersTask implements PullTask {
  readonly name = "customers";
  readonly minIntervalMs = 5 * 60_000;

  constructor(
    private readonly remote: CustomerRemote,
    private readonly repo: CustomerRepository,
    private readonly clock: Clock,
    private readonly onPulled?: () => void,
  ) {}

  async run(): Promise<void> {
    this.repo.replaceAll(await this.remote.fetchAll(), this.clock.nowIso());
    this.onPulled?.();
  }
}
