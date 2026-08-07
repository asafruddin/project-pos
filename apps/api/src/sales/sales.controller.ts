import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { SalesListResponse, SyncSaleRequest, SyncSaleResponse } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { SalesService } from "./sales.service";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(): Promise<SalesListResponse> {
    return this.sales.listToday();
  }

  @Post("sync")
  sync(
    @CurrentUser() user: AuthUser,
    @Body() sale: SyncSaleRequest,
  ): Promise<SyncSaleResponse> {
    if (user.role !== "cashier") {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Hanya kasir yang dapat mengunggah penjualan.",
      });
    }
    return this.sales.acceptSync(sale);
  }
}
