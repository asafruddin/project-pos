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
