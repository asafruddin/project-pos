/** Radix Select forbids empty-string item values — use this sentinel instead. */
export const SELECT_NONE = "__none__";

export function toSelectValue(value: string | null | undefined): string {
  return value ? value : SELECT_NONE;
}

export function fromSelectValue(value: string): string {
  return value === SELECT_NONE ? "" : value;
}
