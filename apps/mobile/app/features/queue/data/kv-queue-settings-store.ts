import type { KvStore } from "@/infrastructure/db/kv-store";
import { defaultQueueSettings, type QueueSettings, type QueueSettingsStore } from "../domain/queue-settings";

const KEY = "store.queueSettings";

export class KvQueueSettingsStore implements QueueSettingsStore {
  constructor(private readonly kv: KvStore) {}

  get(): QueueSettings {
    try {
      const parsed = JSON.parse(this.kv.get(KEY) ?? "null") as Partial<QueueSettings> | null;
      if (parsed?.mode === "daily" || parsed?.mode === "shift" || parsed?.mode === "manual") {
        return { mode: parsed.mode, resetAt: parsed.resetAt ?? null };
      }
    } catch {
      /* fall through */
    }
    return defaultQueueSettings;
  }

  save(settings: { queue_reset_mode?: "daily" | "shift" | "manual" | null; queue_reset_at?: string | null }): void {
    const mode = settings.queue_reset_mode;
    if (mode !== "daily" && mode !== "shift" && mode !== "manual") return;
    this.kv.set(KEY, JSON.stringify({ mode, resetAt: settings.queue_reset_at ?? null }));
  }
}
