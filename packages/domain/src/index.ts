import type { PlaceholderId } from "@pos-apps/types";

/** Pure domain stub — Sale/Stock rules land in later stories. No UI/DB/HTTP imports. */
export function isPlaceholderId(id: PlaceholderId): boolean {
  return typeof id === "string" && id.length > 0;
}
