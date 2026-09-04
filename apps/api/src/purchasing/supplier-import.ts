import type {
  SpreadsheetImportRowError,
  SupplierImportColumn,
  SupplierImportResult,
} from "@pos-apps/types";
import {
  SUPPLIER_IMPORT_COLUMNS,
  SUPPLIER_IMPORT_EXAMPLE_ROW,
  SUPPLIER_IMPORT_REQUIRED_COLUMNS,
} from "@pos-apps/types";
import {
  assertRowLimit,
  buildSpreadsheetCsv,
  buildSpreadsheetXlsx,
  cellToString,
  isEmptyRow,
  mapSpreadsheetHeaders,
  parseOptionalString,
  parseSpreadsheetToGrid,
} from "../common/spreadsheet-file";

export type SupplierImportParsedRow = {
  row: number;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
};

export type ParseSupplierImportResult =
  | { ok: true; rows: SupplierImportParsedRow[]; errors: SpreadsheetImportRowError[] }
  | { ok: false; message: string };

export function emptySupplierImportResult(): SupplierImportResult {
  return { created: 0, updated: 0, updated_keys: [], errors: [] };
}

export function buildSupplierCsvTemplate(): Buffer {
  return buildSpreadsheetCsv(SUPPLIER_IMPORT_COLUMNS, SUPPLIER_IMPORT_EXAMPLE_ROW);
}

export async function buildSupplierXlsxTemplate(): Promise<Buffer> {
  return buildSpreadsheetXlsx(
    "Pemasok",
    SUPPLIER_IMPORT_COLUMNS,
    SUPPLIER_IMPORT_EXAMPLE_ROW,
  );
}

function parseDataRow(
  rowNumber: number,
  cells: unknown[],
  index: Map<SupplierImportColumn, number>,
): { row?: SupplierImportParsedRow; error?: SpreadsheetImportRowError } {
  const get = (col: SupplierImportColumn): string => {
    const i = index.get(col);
    if (i == null) return "";
    return cellToString(cells[i]);
  };

  const name = get("name");
  if (!name) {
    return { error: { row: rowNumber, key: null, message: "name wajib diisi." } };
  }

  const parsed: SupplierImportParsedRow = { row: rowNumber, name };
  const contactName = parseOptionalString(get("contact_name"));
  if (contactName !== undefined) parsed.contactName = contactName;
  const phone = parseOptionalString(get("phone"));
  if (phone !== undefined) parsed.phone = phone;
  const email = parseOptionalString(get("email"));
  if (email !== undefined) parsed.email = email;
  const paymentTerms = parseOptionalString(get("payment_terms"));
  if (paymentTerms !== undefined) parsed.paymentTerms = paymentTerms;
  const notes = parseOptionalString(get("notes"));
  if (notes !== undefined) parsed.notes = notes;
  return { row: parsed };
}

function parseGrid(grid: unknown[][]): ParseSupplierImportResult {
  if (grid.length === 0) {
    return {
      ok: false,
      message: "File kosong. Unduh template, lalu isi baris pemasok.",
    };
  }
  const headerCells = (grid[0] ?? []).map((cell) => cellToString(cell));
  const mapped = mapSpreadsheetHeaders(
    headerCells,
    SUPPLIER_IMPORT_COLUMNS,
    SUPPLIER_IMPORT_REQUIRED_COLUMNS,
  );
  if (!mapped.ok) return mapped;

  const data = grid.slice(1);
  const limited = assertRowLimit(data, "pemasok");
  if (limited) return limited;

  const rows: SupplierImportParsedRow[] = [];
  const errors: SpreadsheetImportRowError[] = [];
  data.forEach((cells, offset) => {
    const rowNumber = offset + 2;
    if (isEmptyRow(cells)) return;
    const parsed = parseDataRow(rowNumber, cells, mapped.index);
    if (parsed.error) errors.push(parsed.error);
    else if (parsed.row) rows.push(parsed.row);
  });
  return { ok: true, rows, errors };
}

export async function parseSupplierImportFile(input: {
  buffer: Buffer;
  filename: string;
}): Promise<ParseSupplierImportResult> {
  const grid = await parseSpreadsheetToGrid(input);
  if (!grid.ok) return grid;
  return parseGrid(grid.grid);
}
