const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Same output as Dashboard `formatIdr` so the model quotes amounts users recognise. */
export function formatIdr(minor: number | null | undefined): string {
  return idr.format(minor ?? 0);
}
