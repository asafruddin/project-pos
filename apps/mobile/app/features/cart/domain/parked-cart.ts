import { AppError } from "@/core/errors/app-error";

export type ParkedCartLine = { productId: string; name: string; priceMinor: number; qty: number };

export type ParkedCart = {
  parkId: string;
  createdAt: string;
  lines: ParkedCartLine[];
  totalMinor: number;
  customerName: string | null;
};

export interface ParkedCartRepository {
  save(cart: ParkedCart): void;
  get(parkId: string): ParkedCart | null;
  delete(parkId: string): void;
  /** Newest first. */
  list(): ParkedCart[];
}

/** Snapshot a cart for later. Not a Sale: no status, no saleId, no outbox (AD-14). */
export function buildParkedCart(
  lines: ParkedCartLine[],
  opts: { parkId: string; createdAt: string; customerName?: string | null },
): ParkedCart {
  if (lines.length === 0) throw new AppError("VALIDATION", "PARK_EMPTY");
  const seen = new Set<string>();
  let totalMinor = 0;
  const snapshot: ParkedCartLine[] = [];
  for (const line of lines) {
    const name = line.name.trim();
    if (!line.productId || !name || seen.has(line.productId)) throw new AppError("VALIDATION", "PARK_INVALID_LINE");
    seen.add(line.productId);
    if (!Number.isInteger(line.qty) || line.qty < 1 || !Number.isInteger(line.priceMinor) || line.priceMinor < 0) {
      throw new AppError("VALIDATION", "PARK_INVALID_LINE");
    }
    snapshot.push({ productId: line.productId, name, priceMinor: line.priceMinor, qty: line.qty });
    totalMinor += line.priceMinor * line.qty;
  }
  return {
    parkId: opts.parkId,
    createdAt: opts.createdAt,
    lines: snapshot,
    totalMinor,
    customerName: opts.customerName?.trim() || null,
  };
}
