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

const CASH_STEP = 10_000;

/** Highest shortcut for this total: under 100.000 stops at 100.000, under 200.000 stops at 200.000. */
function cashOptionCap(payable: number): number | undefined {
  if (payable < 100_000) return 100_000;
  if (payable > 100_000 && payable < 200_000) return 200_000;
  return undefined;
}

/**
 * Four cash amounts, stepping by 10.000 from the total.
 * 65.000 → 70.000, 80.000, 90.000, 100.000. Stops at the cap when four steps do not fit.
 */
export function cashPresets(payable: number): number[] {
  if (!Number.isInteger(payable) || payable <= 0) return [];
  const cap = cashOptionCap(payable);
  const options: number[] = [];
  for (let amount = Math.ceil(payable / CASH_STEP) * CASH_STEP; options.length < 4; amount += CASH_STEP) {
    if (amount < payable) continue;
    if (cap !== undefined && amount > cap) break;
    options.push(amount);
  }
  return options;
}
