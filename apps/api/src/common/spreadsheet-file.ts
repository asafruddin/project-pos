import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { HttpException } from "@nestjs/common";
import type { ProductImportTemplateFormat } from "@pos-apps/types";
import { PRODUCT_IMPORT_MAX_ROWS } from "@pos-apps/types";

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function detectSpreadsheetFormat(
  filename: string,
): ProductImportTemplateFormat | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

export function inferUploadFilename(file: {
  originalname?: string;
  mimetype?: string;
}): string {
  const name = file.originalname?.trim();
  if (name) return name;
  if (
    file.mimetype?.includes("spreadsheet") ||
    file.mimetype?.includes("excel")
  ) {
    return "upload.xlsx";
  }
  return "upload.csv";
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "").trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part) => part.text ?? "").join("").trim();
    }
    if (obj.result != null) return cellToString(obj.result);
    if (obj.text != null) return cellToString(obj.text);
  }
  return String(value).trim();
}

export function isEmptyRow(cells: unknown[]): boolean {
  return cells.every((cell) => cellToString(cell) === "");
}

export function buildSpreadsheetCsv(
  columns: readonly string[],
  example: Record<string, string>,
): Buffer {
  const header = columns.join(",");
  const exampleLine = columns.map((col) => csvEscape(example[col] ?? "")).join(",");
  return Buffer.from(`\uFEFF${header}\n${exampleLine}\n`, "utf8");
}

export async function buildSpreadsheetXlsx(
  sheetName: string,
  columns: readonly string[],
  example: Record<string, string>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...columns]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(columns.map((col) => example[col] ?? ""));
  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = Math.max(14, col.length + 2);
  });
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

export type SpreadsheetGridFail = { ok: false; message: string };
export type SpreadsheetGridOk = { ok: true; grid: unknown[][] };
export type SpreadsheetGridResult = SpreadsheetGridOk | SpreadsheetGridFail;

function parseCsvBuffer(buffer: Buffer): SpreadsheetGridResult {
  try {
    const records = parseCsv(buffer, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
    }) as unknown[][];
    return { ok: true, grid: records };
  } catch {
    return { ok: false, message: "CSV tidak valid. Unduh template, lalu unggah ulang." };
  }
}

async function parseXlsxBuffer(buffer: Buffer): Promise<SpreadsheetGridResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return {
      ok: false,
      message: "Excel tidak valid. Gunakan file .xlsx dari template.",
    };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { ok: false, message: "File Excel tidak berisi lembar data." };
  }
  const grid: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    grid.push(values);
  });
  return { ok: true, grid };
}

export async function parseSpreadsheetToGrid(input: {
  buffer: Buffer;
  filename: string;
}): Promise<SpreadsheetGridResult> {
  const format = detectSpreadsheetFormat(input.filename);
  if (!format) {
    return {
      ok: false,
      message: "Gunakan file .csv atau .xlsx. Unduh template dari halaman impor.",
    };
  }
  if (format === "csv") return parseCsvBuffer(input.buffer);
  return parseXlsxBuffer(input.buffer);
}

export function mapSpreadsheetHeaders<T extends string>(
  rawHeaders: string[],
  columns: readonly T[],
  required: readonly T[],
): { ok: true; index: Map<T, number> } | { ok: false; message: string } {
  const allowed = new Set<string>(columns);
  const index = new Map<T, number>();
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rawHeaders.length; i += 1) {
    const header = rawHeaders[i]?.replace(/^\uFEFF/, "").trim() ?? "";
    if (!header) continue;
    if (seen.has(header)) {
      return { ok: false, message: `Kolom duplikat: ${header}` };
    }
    seen.add(header);
    if (!allowed.has(header)) {
      unknown.push(header);
      continue;
    }
    index.set(header as T, i);
  }
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Kolom tidak dikenali: ${unknown.join(", ")}. Unduh template untuk format yang benar.`,
    };
  }
  const missing = required.filter((col) => !index.has(col));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Kolom wajib tidak ada: ${missing.join(", ")}.`,
    };
  }
  return { ok: true, index };
}

export function assertRowLimit(
  dataRows: unknown[][],
  entityLabel: string,
  maxRows: number = PRODUCT_IMPORT_MAX_ROWS,
): SpreadsheetGridFail | null {
  const count = dataRows.filter((cells) => !isEmptyRow(cells)).length;
  if (count > maxRows) {
    return {
      ok: false,
      message: `Maksimal ${maxRows} baris ${entityLabel} per impor.`,
    };
  }
  return null;
}

export function parseOptionalString(raw: string): string | null | undefined {
  if (raw === "") return undefined;
  return raw;
}

export function parseIntCell(
  raw: string,
  field: string,
  opts: { required: boolean; min: number; max: number },
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (raw === "") {
    if (opts.required) return { ok: false, message: `${field} wajib diisi.` };
    return { ok: true, value: undefined };
  }
  if (!/^-?\d+$/.test(raw)) {
    return {
      ok: false,
      message: `${field} harus bilangan bulat (contoh: 18000).`,
    };
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(n) || n < opts.min || n > opts.max) {
    return { ok: false, message: `${field} di luar rentang yang diizinkan.` };
  }
  return { ok: true, value: n };
}

export function importExceptionMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === "string") return body;
    if (typeof body === "object" && body !== null && "message" in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.map(String).join("; ");
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Gagal mengimpor baris.";
}
