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
  type CustomerImportResult,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { inferUploadFilename } from "../common/spreadsheet-file";
import {
  buildCustomerCsvTemplate,
  buildCustomerXlsxTemplate,
  parseCustomerImportFile,
} from "./customer-import";
import { CustomersService } from "./customers.service";

@Controller("customers/import")
@UseGuards(JwtAuthGuard)
export class CustomerImportController {
  constructor(private readonly customers: CustomersService) {}

  @Get("template")
  @RequirePermission("customers", "update")
  @UseGuards(PermissionsGuard)
  async template(@Query("format") formatRaw?: string): Promise<StreamableFile> {
    const format = (formatRaw ?? "csv").trim().toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      throw new BadRequestException({
        code: "CUSTOMER_IMPORT_INVALID",
        message: "format harus csv atau xlsx.",
      });
    }
    if (format === "xlsx") {
      const buffer = await buildCustomerXlsxTemplate();
      return new StreamableFile(buffer, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: 'attachment; filename="pelanggan-impor-template.xlsx"',
      });
    }
    return new StreamableFile(buildCustomerCsvTemplate(), {
      type: "text/csv; charset=utf-8",
      disposition: 'attachment; filename="pelanggan-impor-template.csv"',
    });
  }

  @Post()
  @RequirePermission("customers", "update")
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
  ): Promise<CustomerImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: "CUSTOMER_IMPORT_INVALID",
        message: "Pilih file CSV atau Excel (.xlsx).",
      });
    }
    const parsed = await parseCustomerImportFile({
      buffer: file.buffer,
      filename: inferUploadFilename(file),
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: "CUSTOMER_IMPORT_INVALID",
        message: parsed.message,
      });
    }
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      throw new BadRequestException({
        code: "CUSTOMER_IMPORT_INVALID",
        message: "File tidak berisi data pelanggan.",
      });
    }
    return this.customers.importCustomers(parsed.rows, parsed.errors, user);
  }
}
