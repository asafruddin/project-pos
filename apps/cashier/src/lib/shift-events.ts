export const SHIFT_CHANGED_EVENT = "pos-shift-changed";

export function notifyShiftChanged() {
  window.dispatchEvent(new Event(SHIFT_CHANGED_EVENT));
}
