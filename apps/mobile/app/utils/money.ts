/**
 * Rupiah formatting. Hermes' `Intl` currency output is inconsistent across devices, so format by hand
 * to match the PWA (`id-ID` → "Rp 53.000", `en-US` → "IDR 53,000"; non-breaking space like Intl).
 */
export function formatIdr(amountMinor: number, lang: "id" | "en" = "id"): string {
  const negative = amountMinor < 0;
  const digits = Math.abs(Math.trunc(amountMinor)).toString();
  const sep = lang === "en" ? "," : ".";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${negative ? "-" : ""}${lang === "en" ? "IDR" : "Rp"} ${grouped}`;
}

/** Grouped integer without currency: 53000 → "53.000" (id) / "53,000" (en). */
export function formatGroupedInt(value: number, lang: "id" | "en" = "id"): string {
  if (!Number.isFinite(value)) return "";
  return Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === "en" ? "," : ".");
}

/** Digits only → integer, or NaN when empty (PWA `parseGroupedInt`). */
export function parseGroupedInt(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? Number.NaN : Number.parseInt(digits, 10);
}

/** Live-format a numeric text field: "5000" → "5.000". */
export function formatGroupedIntInput(raw: string, lang: "id" | "en" = "id"): string {
  const n = parseGroupedInt(raw);
  return Number.isNaN(n) ? "" : formatGroupedInt(n, lang);
}
