import type { Promotion } from "@pos-apps/types";
import type { KvStore } from "@/infrastructure/db/kv-store";
import type { PromotionRepository } from "../domain/ports";

const KEY = "cache.promotions";

export class KvPromotionRepository implements PromotionRepository {
  constructor(
    private readonly kv: KvStore,
    private readonly onReplaced?: () => void,
  ) {}

  get(): Promotion[] {
    try {
      const parsed = JSON.parse(this.kv.get(KEY) ?? "null") as { promotions?: Promotion[] } | null;
      return Array.isArray(parsed?.promotions) ? parsed.promotions : [];
    } catch {
      return [];
    }
  }

  replace(promotions: Promotion[]): void {
    this.kv.set(KEY, JSON.stringify({ promotions }));
    this.onReplaced?.();
  }
}
