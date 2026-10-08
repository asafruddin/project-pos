import {
  formatGroupedIntInput,
  parseGroupedInt,
} from "@pos-apps/ui/lib/grouped-int";

export { formatGroupedIntInput, parseGroupedInt };

export function formatIdr(minor: number, lang: "id" | "en" = "id"): string {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(minor);
}

const CASH_STEP = 10_000;

/** Highest shortcut for this total: under 100.000 stops at 100.000, under 200.000 stops at 200.000. */
function cashOptionCap(payable: number): number | undefined {
  if (payable < 100_000) return 100_000;
  if (payable > 100_000 && payable < 200_000) return 200_000;
  return undefined;
}

/** Four cash amounts, stepping by 10.000 from the total. 65.000 → 70.000, 80.000, 90.000, 100.000. */
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

/** Integer → grouped display (id: 53.000, en: 53,000). */
export function formatGroupedInt(
  value: number,
  lang: "id" | "en" = "id",
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}
