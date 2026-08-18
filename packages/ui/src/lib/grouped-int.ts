/** Digits-only parse ( tolerates thousand separators like 53.000 ). */
export function parseGroupedInt(raw: string): number {
  return Number.parseInt(raw.replace(/\D/g, ""), 10)
}

/** Format a digit string or number as id-ID grouped (53.000). Empty stays empty. */
export function formatGroupedIntInput(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits === "") return ""
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n)) return ""
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)
}
