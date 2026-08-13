import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type {
  ReportCashiersResponse,
  ReportInventoryResponse,
  ReportProductsResponse,
  ReportSummary,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("summary")
  @RequirePermission("reports", "view")
  @UseGuards(PermissionsGuard)
  summary(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("store_id") store_id?: string,
  ): Promise<ReportSummary> {
    return this.reports.summary({ from, to, store_id }, user);
  }

  @Get("products")
  @RequirePermission("reports", "view")
  @UseGuards(PermissionsGuard)
  products(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("store_id") store_id?: string,
  ): Promise<ReportProductsResponse> {
    return this.reports.products({ from, to, store_id }, user);
  }

  @Get("inventory")
  @RequirePermission("reports", "view_financial")
  @UseGuards(PermissionsGuard)
  inventory(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("store_id") store_id?: string,
  ): Promise<ReportInventoryResponse> {
    return this.reports.inventory({ from, to, store_id }, user);
  }

  @Get("cashiers")
  @RequirePermission("reports", "view")
  @UseGuards(PermissionsGuard)
  cashiers(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("store_id") store_id?: string,
  ): Promise<ReportCashiersResponse> {
    return this.reports.cashiers({ from, to, store_id }, user);
  }

  @Get("export")
  @RequirePermission("reports", "export")
  @UseGuards(PermissionsGuard)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="reports.csv"')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("store_id") store_id?: string,
  ): Promise<StreamableFile> {
    const csv = await this.reports.exportCsv({ from, to, store_id }, user);
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: 'attachment; filename="reports.csv"',
    });
  }
}
