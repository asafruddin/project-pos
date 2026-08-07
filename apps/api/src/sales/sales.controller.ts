import { Controller, Get, UseGuards } from "@nestjs/common";
import type { SalesListResponse } from "@pos-apps/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SalesService } from "./sales.service";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(): Promise<SalesListResponse> {
    return this.sales.listToday();
  }
}
