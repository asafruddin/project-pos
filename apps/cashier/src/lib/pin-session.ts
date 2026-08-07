const UNLOCK_KEY = "pos_cashier_pin_unlocked";

export function setPinUnlocked(unlocked: boolean): void {
  if (typeof window === "undefined") return;
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
