import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_EXAMPLE_ROW,
} from "@pos-apps/types";
import {
  buildCsvTemplate,
  buildXlsxTemplate,
  parseProductImportFile,
} from "./product-import";

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

describe("parseProductImportFile", () => {
  it("parses the CSV template example row", async () => {
    const parsed = await parseProductImportFile({
      buffer: buildCsvTemplate(),
      filename: "produk-impor-template.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      row: 2,
      name: "Espresso",
      priceMinor: 18000,
      stockQty: 50,
      sku: "ESP-001",
      tags: ["kopi", "hot"],
      categoryName: "Minuman",
      unitName: "pcs",
      status: "active",
      trackStock: true,
      parentSku: null,
    });
  });

  it("parses an xlsx template", async () => {
    const buffer = await buildXlsxTemplate();
    const parsed = await parseProductImportFile({
      buffer,
      filename: "produk-impor-template.xlsx",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.sku).toBe("ESP-001");
    expect(parsed.rows[0]?.priceMinor).toBe(18000);
  });

  it("rejects unknown headers", async () => {
    const parsed = await parseProductImportFile({
      buffer: csvFromRows([
        ["name", "price_minor", "stock_qty", "foo"],
        ["Latte", "25000", "3", "x"],
      ]),
      filename: "produk.csv",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("foo");
  });

  it("rejects missing required headers", async () => {
    const parsed = await parseProductImportFile({
      buffer: csvFromRows([
        ["name", "sku"],
        ["Latte", "LAT-1"],
      ]),
      filename: "produk.csv",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("price_minor");
  });

  it("skips empty rows and collects row errors", async () => {
    const header = [...PRODUCT_IMPORT_COLUMNS];
    const blank = PRODUCT_IMPORT_COLUMNS.map(() => "");
    const good = PRODUCT_IMPORT_COLUMNS.map(
      (col) => PRODUCT_IMPORT_EXAMPLE_ROW[col],
    );
    const badPrice = [...good];
    badPrice[1] = "18.5";
    const parsed = await parseProductImportFile({
      buffer: csvFromRows([header, blank, good, badPrice]),
      filename: "produk.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]?.row).toBe(4);
    expect(parsed.errors[0]?.message).toContain("price_minor");
  });

  it("parses comma-separated tags and optional blanks", async () => {
    const parsed = await parseProductImportFile({
      buffer: csvFromRows([
        ["name", "price_minor", "stock_qty", "tags", "sku"],
        ["Teh", "12000", "0", "panas, manis", "TEH-1"],
      ]),
      filename: "produk.csv",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.tags).toEqual(["panas", "manis"]);
    expect(parsed.rows[0]?.barcode).toBeUndefined();
  });

  it("rejects unsupported extensions", async () => {
    const parsed = await parseProductImportFile({
      buffer: Buffer.from("name"),
      filename: "produk.xls",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain(".csv");
  });
});
