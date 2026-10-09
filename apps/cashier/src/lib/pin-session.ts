const UNLOCK_KEY = "pos_cashier_pin_unlocked";
const SHIFT_CLOSED_KEY = "pos_cashier_shift_closed";

export function setPinUnlocked(unlocked: boolean): void {
  if (typeof window === "undefined") return;
  // A new PIN unlock or a lock both start a fresh session: the "just closed" mark no longer applies.
  sessionStorage.removeItem(SHIFT_CLOSED_KEY);
  if (unlocked) {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } else {
    sessionStorage.removeItem(UNLOCK_KEY);
  }
}

export function isPinUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function clearPinUnlock(): void {
  setPinUnlocked(false);
}

/** The shift was closed in this PIN session: keep the open-shift dialog away until the next PIN unlock. */
export function markShiftClosed(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SHIFT_CLOSED_KEY, "1");
}

export function isShiftClosedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SHIFT_CLOSED_KEY) === "1";
}
