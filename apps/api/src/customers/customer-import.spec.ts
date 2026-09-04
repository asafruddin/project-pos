import {
  CUSTOMER_IMPORT_COLUMNS,
  CUSTOMER_IMPORT_EXAMPLE_ROW,
} from "@pos-apps/types";
import {
  buildCustomerCsvTemplate,
  buildCustomerXlsxTemplate,
  parseCustomerImportFile,
} from "./customer-import";

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

describe("parseCustomerImportFile", () => {
  it("parses the CSV template example row", async () => {
    const parsed = await parseCustomerImportFile({
      buffer: buildCustomerCsvTemplate(),
      filename: "pelanggan-impor-template.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      row: 2,
      name: "Budi",
      phone: "08123456789",
      email: "budi@example.com",
      key: "08123456789",
      storeCreditMinor: 0,
    });
  });

  it("parses an xlsx template", async () => {
    const buffer = await buildCustomerXlsxTemplate();
    const parsed = await parseCustomerImportFile({
      buffer,
      filename: "pelanggan-impor-template.xlsx",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.phone).toBe("08123456789");
  });

  it("rejects a row without phone or email", async () => {
    const parsed = await parseCustomerImportFile({
      buffer: csvFromRows([
        ["name", "phone", "email"],
        ["Sari", "", ""],
      ]),
      filename: "pelanggan.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toContain("telepon atau email");
  });

  it("skips empty rows", async () => {
    const header = [...CUSTOMER_IMPORT_COLUMNS];
    const blank = CUSTOMER_IMPORT_COLUMNS.map(() => "");
    const good = CUSTOMER_IMPORT_COLUMNS.map(
      (col) => CUSTOMER_IMPORT_EXAMPLE_ROW[col],
    );
    const parsed = await parseCustomerImportFile({
      buffer: csvFromRows([header, blank, good]),
      filename: "pelanggan.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toHaveLength(0);
  });
});
