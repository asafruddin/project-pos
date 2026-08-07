export function formatIdr(minor: number, lang: "id" | "en" = "id"): string {
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(minor);
}
