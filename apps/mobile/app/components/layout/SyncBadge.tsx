import { useStore } from "zustand";
import { useContainer } from "@/core/di/container-context";
import { useT } from "@/i18n";
import { StatusPill, type Tone } from "@/components/ui";

export function SyncBadge() {
  const container = useContainer();
  const { phase, pending, dead } = useStore(container.syncStatus);
  const { t } = useT();
  let tone: Tone = "success";
  let label = t("syncIdle");
  if (dead > 0) {
    tone = "danger";
    label = `${t("syncFailedItems")} (${dead})`;
  } else if (phase === "auth_required") {
    tone = "danger";
    label = t("syncAuth");
  } else if (phase === "offline") {
    tone = "warning";
    label = pending > 0 ? `${t("syncPending")} (${pending})` : t("syncOffline");
  } else if (pending > 0) {
    tone = "warning";
    label = `${t("syncPending")} (${pending})`;
  } else if (phase === "syncing") {
    tone = "neutral";
    label = t("syncSyncing");
  }
  return <StatusPill label={label} tone={tone} />;
}
