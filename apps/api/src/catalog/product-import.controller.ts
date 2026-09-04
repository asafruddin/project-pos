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
  type ProductImportResult,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CatalogService } from "./catalog.service";
import { inferUploadFilename } from "../common/spreadsheet-file";
import {
  buildCsvTemplate,
  buildXlsxTemplate,
  parseProductImportFile,
} from "./product-import";

@Controller("catalog/products/import")
@UseGuards(JwtAuthGuard)
export class ProductImportController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("template")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  async template(
    @Query("format") formatRaw?: string,
  ): Promise<StreamableFile> {
    const format = (formatRaw ?? "csv").trim().toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      throw new BadRequestException({
        code: "CATALOG_IMPORT_INVALID",
        message: "format harus csv atau xlsx.",
      });
    }
    if (format === "xlsx") {
      const buffer = await buildXlsxTemplate();
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: 'attachment; filename="produk-impor-template.xlsx"',
      });
    }
    return new StreamableFile(buildCsvTemplate(), {
      type: "text/csv; charset=utf-8",
      disposition: 'attachment; filename="produk-impor-template.csv"',
    });
  }

  @Post()
  @RequirePermission("products", "update")
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
    @CurrentUser() user: AuthUser,
  ): Promise<ProductImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: "CATALOG_IMPORT_INVALID",
        message: "Pilih file CSV atau Excel (.xlsx).",
      });
    }
    const parsed = await parseProductImportFile({
      buffer: file.buffer,
      filename: inferUploadFilename(file),
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: "CATALOG_IMPORT_INVALID",
        message: parsed.message,
      });
    }
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      throw new BadRequestException({
        code: "CATALOG_IMPORT_INVALID",
        message: "File tidak berisi data produk.",
      });
    }
    return this.catalog.importProducts(
      parsed.rows,
      parsed.errors,
      user.userId,
      user.storeId ?? "00000000-0000-4000-8000-000000000001",
    );
  }
}
