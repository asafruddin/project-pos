import type {
  ProductImportColumn,
  ProductImportResult,
  ProductImportRowError,
  ProductImportTemplateFormat,
  ProductStatus,
} from "@pos-apps/types";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_EXAMPLE_ROW,
  PRODUCT_IMPORT_REQUIRED_COLUMNS,
} from "@pos-apps/types";
import {
  assertRowLimit,
  buildSpreadsheetCsv,
  buildSpreadsheetXlsx,
  cellToString,
  detectSpreadsheetFormat,
  isEmptyRow,
  mapSpreadsheetHeaders,
  parseIntCell,
  parseOptionalString,
  parseSpreadsheetToGrid,
} from "../common/spreadsheet-file";

const INT32_MAX = 2_147_483_647;
const INT32_MIN = -2_147_483_648;

export type ProductImportParsedRow = {
  row: number;
  sku: string | null;
  parentSku: string | null;
  name: string;
  priceMinor: number;
  stockQty: number;
  barcode?: string | null;
  description?: string | null;
  status?: ProductStatus;
  costMinor?: number | null;
  compareAtMinor?: number | null;
  minQty?: number | null;
  maxQty?: number | null;
  trackStock?: boolean;
  categoryName?: string | null;
  brandName?: string | null;
  unitName?: string | null;
  tags?: string[];
};

export type ParseProductImportOk = {
  ok: true;
  rows: ProductImportParsedRow[];
  errors: ProductImportRowError[];
};

export type ParseProductImportFail = {
  ok: false;
  message: string;
};

export type ParseProductImportResult = ParseProductImportOk | ParseProductImportFail;

export function emptyImportResult(): ProductImportResult {
  return { created: 0, updated: 0, updated_skus: [], errors: [] };
}

export function buildCsvTemplate(): Buffer {
  return buildSpreadsheetCsv(PRODUCT_IMPORT_COLUMNS, PRODUCT_IMPORT_EXAMPLE_ROW);
}

export async function buildXlsxTemplate(): Promise<Buffer> {
  return buildSpreadsheetXlsx(
    "Produk",
    PRODUCT_IMPORT_COLUMNS,
    PRODUCT_IMPORT_EXAMPLE_ROW,
  );
}

export function detectImportFormat(
  filename: string,
): ProductImportTemplateFormat | null {
  return detectSpreadsheetFormat(filename);
}

function parseBoolField(
  raw: string,
  field: string,
  row: number,
  sku: string | null,
): boolean | undefined | ProductImportRowError {
  if (raw === "") return undefined;
  const normalized = raw.toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return {
    row,
    sku,
    message: `${field} harus true atau false.`,
  };
}

function parseStatus(
  raw: string,
  row: number,
  sku: string | null,
): ProductStatus | undefined | ProductImportRowError {
  if (raw === "") return undefined;
  if (raw === "active" || raw === "inactive") return raw;
  return {
    row,
    sku,
    message: "status harus active atau inactive.",
  };
}

function parseTags(raw: string): string[] | undefined {
  if (raw === "") return undefined;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isRowError(value: unknown): value is ProductImportRowError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    "row" in value
  );
}

function intOrError(
  raw: string,
  field: string,
  row: number,
  sku: string | null,
  opts: { required: boolean; min: number; max: number },
): number | undefined | ProductImportRowError {
  const parsed = parseIntCell(raw, field, opts);
  if (!parsed.ok) return { row, sku, message: parsed.message };
  return parsed.value;
}

function parseDataRow(
  rowNumber: number,
  cells: unknown[],
  index: Map<ProductImportColumn, number>,
): { row?: ProductImportParsedRow; error?: ProductImportRowError } {
  const get = (col: ProductImportColumn): string => {
    const i = index.get(col);
    if (i == null) return "";
    return cellToString(cells[i]);
  };

  const skuRaw = get("sku");
  const sku = skuRaw === "" ? null : skuRaw;
  const nameRaw = get("name");
  if (!nameRaw) {
    return { error: { row: rowNumber, sku, message: "name wajib diisi." } };
  }

  const price = intOrError(get("price_minor"), "price_minor", rowNumber, sku, {
    required: true,
    min: 0,
    max: INT32_MAX,
  });
  if (isRowError(price)) return { error: price };
  const stock = intOrError(get("stock_qty"), "stock_qty", rowNumber, sku, {
    required: true,
    min: 0,
    max: INT32_MAX,
  });
  if (isRowError(stock)) return { error: stock };

  const cost = intOrError(get("cost_minor"), "cost_minor", rowNumber, sku, {
    required: false,
    min: 0,
    max: INT32_MAX,
  });
  if (isRowError(cost)) return { error: cost };
  const compareAt = intOrError(
    get("compare_at_minor"),
    "compare_at_minor",
    rowNumber,
    sku,
    { required: false, min: 0, max: INT32_MAX },
  );
  if (isRowError(compareAt)) return { error: compareAt };
  const minQty = intOrError(get("min_qty"), "min_qty", rowNumber, sku, {
    required: false,
    min: INT32_MIN,
    max: INT32_MAX,
  });
  if (isRowError(minQty)) return { error: minQty };
  const maxQty = intOrError(get("max_qty"), "max_qty", rowNumber, sku, {
    required: false,
    min: INT32_MIN,
    max: INT32_MAX,
  });
  if (isRowError(maxQty)) return { error: maxQty };

  const status = parseStatus(get("status"), rowNumber, sku);
  if (isRowError(status)) return { error: status };
  const trackStock = parseBoolField(get("track_stock"), "track_stock", rowNumber, sku);
  if (isRowError(trackStock)) return { error: trackStock };

  const parentSkuRaw = get("parent_sku");
  const parsed: ProductImportParsedRow = {
    row: rowNumber,
    sku,
    parentSku: parentSkuRaw === "" ? null : parentSkuRaw,
    name: nameRaw,
    priceMinor: price ?? 0,
    stockQty: stock ?? 0,
  };
  if (sku !== null && parsed.parentSku && sku === parsed.parentSku) {
    return {
      error: {
        row: rowNumber,
        sku,
        message: "parent_sku tidak boleh sama dengan sku baris ini.",
      },
    };
  }

  const barcode = parseOptionalString(get("barcode"));
  if (barcode !== undefined) parsed.barcode = barcode;
  const description = parseOptionalString(get("description"));
  if (description !== undefined) parsed.description = description;
  if (status !== undefined) parsed.status = status;
  if (cost !== undefined) parsed.costMinor = cost;
  if (compareAt !== undefined) parsed.compareAtMinor = compareAt;
  if (minQty !== undefined) parsed.minQty = minQty;
  if (maxQty !== undefined) parsed.maxQty = maxQty;
  if (trackStock !== undefined) parsed.trackStock = trackStock;
  const categoryName = parseOptionalString(get("category_name"));
  if (categoryName !== undefined) parsed.categoryName = categoryName;
  const brandName = parseOptionalString(get("brand_name"));
  if (brandName !== undefined) parsed.brandName = brandName;
  const unitName = parseOptionalString(get("unit_name"));
  if (unitName !== undefined) parsed.unitName = unitName;
  const tags = parseTags(get("tags"));
  if (tags !== undefined) parsed.tags = tags;
  return { row: parsed };
}

function parseGrid(grid: unknown[][]): ParseProductImportResult {
  if (grid.length === 0) {
    return { ok: false, message: "File kosong. Unduh template, lalu isi baris produk." };
  }
  const headerCells = (grid[0] ?? []).map((cell) => cellToString(cell));
  const mapped = mapSpreadsheetHeaders(
    headerCells,
    PRODUCT_IMPORT_COLUMNS,
    PRODUCT_IMPORT_REQUIRED_COLUMNS,
  );
  if (!mapped.ok) return mapped;

  const data = grid.slice(1);
  const limited = assertRowLimit(data, "produk");
  if (limited) return limited;

  const rows: ProductImportParsedRow[] = [];
  const errors: ProductImportRowError[] = [];
  data.forEach((cells, offset) => {
    const rowNumber = offset + 2;
    if (isEmptyRow(cells)) return;
    const parsed = parseDataRow(rowNumber, cells, mapped.index);
    if (parsed.error) errors.push(parsed.error);
    else if (parsed.row) rows.push(parsed.row);
  });
  return { ok: true, rows, errors };
}

export async function parseProductImportFile(input: {
  buffer: Buffer;
  filename: string;
}): Promise<ParseProductImportResult> {
  const grid = await parseSpreadsheetToGrid(input);
  if (!grid.ok) return grid;
  return parseGrid(grid.grid);
}
