import { parseGroupedInt } from "@pos-apps/ui/lib/grouped-int";

export { parseGroupedInt };

/** Phase 1: price_minor is integer rupiah (Rp). */
export function formatIdr(priceMinor: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceMinor);
}
