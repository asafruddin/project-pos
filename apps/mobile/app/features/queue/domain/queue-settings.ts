import type { QueueResetMode } from "@pos-apps/types";

/** Store-wide queue reset setting, cached on the device (set in the dashboard). */
export type QueueSettings = { mode: QueueResetMode; resetAt: string | null };

export const defaultQueueSettings: QueueSettings = { mode: "daily", resetAt: null };

export interface QueueSettingsStore {
  get(): QueueSettings;
  save(settings: { queue_reset_mode?: QueueResetMode | null; queue_reset_at?: string | null }): void;
}
