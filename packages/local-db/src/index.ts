import type { PlaceholderId } from "@pos-apps/types";

/** IndexedDB / idb wiring starts in later cashier stories. */
export const LOCAL_DB_NAME = "pos-apps-local";

export function describeLocalDbStub(deviceId?: PlaceholderId): string {
  return deviceId
    ? `local-db stub ready for device ${deviceId}`
    : "local-db stub ready";
}
