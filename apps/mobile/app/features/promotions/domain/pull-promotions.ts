import type { PullTask } from "@/infrastructure/sync/pull-task";
import type { PromotionRemote, PromotionRepository } from "./ports";

/** Last successful pull wins; a failed pull never clears the cache (AD-18). */
export class PullPromotionsTask implements PullTask {
  readonly name = "promotions";
  readonly minIntervalMs = 5 * 60_000;

  constructor(
    private readonly remote: PromotionRemote,
    private readonly repo: PromotionRepository,
  ) {}

  async run(): Promise<void> {
    this.repo.replace(await this.remote.fetchAll());
  }
}
