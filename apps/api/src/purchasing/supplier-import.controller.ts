import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  PRODUCT_IMPORT_MAX_BYTES,
  type SupplierImportResult,
} from "@pos-apps/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { inferUploadFilename } from "../common/spreadsheet-file";
import {
  buildSupplierCsvTemplate,
  buildSupplierXlsxTemplate,
  parseSupplierImportFile,
} from "./supplier-import";
import { SupplierService } from "./supplier.service";

@Controller("purchasing/suppliers/import")
@UseGuards(JwtAuthGuard)
export class SupplierImportController {
  constructor(private readonly suppliers: SupplierService) {}

  @Get("template")
  @RequirePermission("purchases", "update")
  @UseGuards(PermissionsGuard)
  async template(@Query("format") formatRaw?: string): Promise<StreamableFile> {
    const format = (formatRaw ?? "csv").trim().toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      throw new BadRequestException({
        code: "SUPPLIER_IMPORT_INVALID",
        message: "format harus csv atau xlsx.",
      });
    }
    if (format === "xlsx") {
      const buffer = await buildSupplierXlsxTemplate();
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: 'attachment; filename="pemasok-impor-template.xlsx"',
      });
    }
    return new StreamableFile(buildSupplierCsvTemplate(), {
      type: "text/csv; charset=utf-8",
      disposition: 'attachment; filename="pemasok-impor-template.csv"',
    });
  }

  @Post()
  @RequirePermission("purchases", "update")
  @UseGuards(PermissionsGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: PRODUCT_IMPORT_MAX_BYTES } }),
  )
  async importFile(
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype?: string;
          size: number;
        }
      | undefined,
  ): Promise<SupplierImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: "SUPPLIER_IMPORT_INVALID",
        message: "Pilih file CSV atau Excel (.xlsx).",
      });
    }
    const parsed = await parseSupplierImportFile({
      buffer: file.buffer,
      filename: inferUploadFilename(file),
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: "SUPPLIER_IMPORT_INVALID",
        message: parsed.message,
      });
    }
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      throw new BadRequestException({
        code: "SUPPLIER_IMPORT_INVALID",
        message: "File tidak berisi data pemasok.",
      });
    }
    return this.suppliers.importSuppliers(parsed.rows, parsed.errors);
  }
}
