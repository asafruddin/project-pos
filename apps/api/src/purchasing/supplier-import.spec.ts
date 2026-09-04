import { SUPPLIER_IMPORT_EXAMPLE_ROW } from "@pos-apps/types";
import {
  buildSupplierCsvTemplate,
  parseSupplierImportFile,
} from "./supplier-import";

function csvFromRows(rows: string[][]): Buffer {
  return Buffer.from(
    rows
      .map((row) =>
        row
          .map((cell) =>
            /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
          )
          .join(","),
      )
      .join("\n"),
    "utf8",
  );
}

describe("parseSupplierImportFile", () => {
  it("parses the CSV template example row", async () => {
    const parsed = await parseSupplierImportFile({
      buffer: buildSupplierCsvTemplate(),
      filename: "pemasok-impor-template.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toMatchObject({
      name: SUPPLIER_IMPORT_EXAMPLE_ROW.name,
      phone: SUPPLIER_IMPORT_EXAMPLE_ROW.phone,
      paymentTerms: SUPPLIER_IMPORT_EXAMPLE_ROW.payment_terms,
    });
  });

  it("rejects a row without name", async () => {
    const parsed = await parseSupplierImportFile({
      buffer: csvFromRows([
        ["name", "phone"],
        ["", "0812"],
      ]),
      filename: "pemasok.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toContain("name");
  });
});
