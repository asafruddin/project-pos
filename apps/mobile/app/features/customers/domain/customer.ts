export type Customer = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  groupName: string | null;
  storeCreditMinor: number;
  loyaltyPoints: number;
  loyaltyTier: string | null;
};

/** Case-insensitive match on name, phone, email, group (port of `matchCustomers`). */
export function matchCustomers(rows: Customer[], query: string): Customer[] {
  const term = query.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    [row.name, row.phone, row.email, row.groupName].some((v) => (v ?? "").toLowerCase().includes(term)),
  );
}
