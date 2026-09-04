import { evaluateCustomerProfile } from "@pos-apps/domain";
import type {
  CustomerImportColumn,
  CustomerImportResult,
  SpreadsheetImportRowError,
} from "@pos-apps/types";
import {
  CUSTOMER_IMPORT_COLUMNS,
  CUSTOMER_IMPORT_EXAMPLE_ROW,
  CUSTOMER_IMPORT_REQUIRED_COLUMNS,
} from "@pos-apps/types";
import {
  assertRowLimit,
  buildSpreadsheetCsv,
  buildSpreadsheetXlsx,
  cellToString,
  isEmptyRow,
  mapSpreadsheetHeaders,
  parseIntCell,
  parseOptionalString,
  parseSpreadsheetToGrid,
} from "../common/spreadsheet-file";

const INT32_MAX = 2_147_483_647;

export type CustomerImportParsedRow = {
  row: number;
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  groupName?: string | null;
  storeCreditMinor?: number;
};

export type ParseCustomerImportResult =
  | { ok: true; rows: CustomerImportParsedRow[]; errors: SpreadsheetImportRowError[] }
  | { ok: false; message: string };

export function emptyCustomerImportResult(): CustomerImportResult {
  return { created: 0, updated: 0, updated_keys: [], errors: [] };
}

export function buildCustomerCsvTemplate(): Buffer {
  return buildSpreadsheetCsv(CUSTOMER_IMPORT_COLUMNS, CUSTOMER_IMPORT_EXAMPLE_ROW);
}

export async function buildCustomerXlsxTemplate(): Promise<Buffer> {
  return buildSpreadsheetXlsx(
    "Pelanggan",
    CUSTOMER_IMPORT_COLUMNS,
    CUSTOMER_IMPORT_EXAMPLE_ROW,
  );
}

function parseDataRow(
  rowNumber: number,
  cells: unknown[],
  index: Map<CustomerImportColumn, number>,
): { row?: CustomerImportParsedRow; error?: SpreadsheetImportRowError } {
  const get = (col: CustomerImportColumn): string => {
    const i = index.get(col);
    if (i == null) return "";
    return cellToString(cells[i]);
  };

  const phoneRaw = parseOptionalString(get("phone"));
  const emailRaw = parseOptionalString(get("email"));
  const notesRaw = parseOptionalString(get("notes"));
  const groupRaw = parseOptionalString(get("group_name"));
  const profile = evaluateCustomerProfile({
    name: get("name"),
    phone: phoneRaw === undefined ? null : phoneRaw,
    email: emailRaw === undefined ? null : emailRaw,
    notes: notesRaw === undefined ? null : notesRaw,
    group_name: groupRaw === undefined ? null : groupRaw,
  });
  if (!profile.ok) {
    return {
      error: {
        row: rowNumber,
        key: phoneRaw || emailRaw || null,
        message: profile.message,
      },
    };
  }

  const credit = parseIntCell(get("store_credit_minor"), "store_credit_minor", {
    required: false,
    min: 0,
    max: INT32_MAX,
  });
  if (!credit.ok) {
    return {
      error: {
        row: rowNumber,
        key: profile.phone ?? profile.email,
        message: credit.message,
      },
    };
  }

  const parsed: CustomerImportParsedRow = {
    row: rowNumber,
    key: profile.phone ?? profile.email ?? "",
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
  };
  if (notesRaw !== undefined) parsed.notes = profile.notes;
  if (groupRaw !== undefined) parsed.groupName = profile.group_name;
  if (credit.value !== undefined) parsed.storeCreditMinor = credit.value;
  return { row: parsed };
}

function parseGrid(grid: unknown[][]): ParseCustomerImportResult {
  if (grid.length === 0) {
    return {
      ok: false,
      message: "File kosong. Unduh template, lalu isi baris pelanggan.",
    };
  }
  const headerCells = (grid[0] ?? []).map((cell) => cellToString(cell));
  const mapped = mapSpreadsheetHeaders(
    headerCells,
    CUSTOMER_IMPORT_COLUMNS,
    CUSTOMER_IMPORT_REQUIRED_COLUMNS,
  );
  if (!mapped.ok) return mapped;

  const data = grid.slice(1);
  const limited = assertRowLimit(data, "pelanggan");
  if (limited) return limited;

  const rows: CustomerImportParsedRow[] = [];
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

export async function parseCustomerImportFile(input: {
  buffer: Buffer;
  filename: string;
}): Promise<ParseCustomerImportResult> {
  const grid = await parseSpreadsheetToGrid(input);
  if (!grid.ok) return grid;
  return parseGrid(grid.grid);
}
