export type Shift = {
  shiftId: string;
  storeId: string | null;
  registerId: string | null;
  openedAt: string;
  openingCashMinor: number;
  status: "open" | "closed";
  closedAt: string | null;
  countedCashMinor: number | null;
  expectedCashMinor: number | null;
  differenceMinor: number | null;
};

export type CashMovement = {
  movementId: string;
  shiftId: string;
  kind: "in" | "out";
  amountMinor: number;
  reason: string;
  occurredAt: string;
};

/** Slice of a sale needed for cash reconciliation. */
export type CashSaleView = {
  shiftId: string | null;
  tenders: { method: string; amountMinor: number }[];
  paymentMethod: string;
  amountMinor: number;
  voidedAt: string | null;
};
