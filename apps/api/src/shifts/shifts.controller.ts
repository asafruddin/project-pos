import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  CloseShiftResponse,
  CurrentShiftResponse,
  OpenShiftResponse,
  RecordCashMovementResponse,
  ShiftDetailResponse,
  ShiftListResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CloseShiftDto } from "./dto/close-shift.dto";
import { OpenShiftDto } from "./dto/open-shift.dto";
import { RecordCashMovementDto } from "./dto/record-cash.dto";
import { ShiftsService } from "./shifts.service";

@Controller("shifts")
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get("current")
  current(): Promise<CurrentShiftResponse> {
    return this.shifts.current();
  }

  @Get()
  list(): Promise<ShiftListResponse> {
    return this.shifts.list();
  }

  @Get(":shiftId")
  get(
    @Param("shiftId", ParseUUIDPipe) shiftId: string,
  ): Promise<ShiftDetailResponse> {
    return this.shifts.get(shiftId);
  }

  @Post()
  @RequirePermission("shifts", "create")
  @UseGuards(PermissionsGuard)
  open(
    @CurrentUser() user: AuthUser,
    @Body() body: OpenShiftDto,
  ): Promise<OpenShiftResponse> {
    return this.shifts.open(body, user.userId);
  }

  @Post(":shiftId/cash")
  @RequirePermission("shifts", "update")
  @UseGuards(PermissionsGuard)
  recordCash(
    @CurrentUser() user: AuthUser,
    @Param("shiftId", ParseUUIDPipe) shiftId: string,
    @Body() body: RecordCashMovementDto,
  ): Promise<RecordCashMovementResponse> {
    return this.shifts.recordCash(shiftId, body, user.userId);
  }

  @Post(":shiftId/close")
  @RequirePermission("shifts", "update")
  @UseGuards(PermissionsGuard)
  close(
    @CurrentUser() user: AuthUser,
    @Param("shiftId", ParseUUIDPipe) shiftId: string,
    @Body() body: CloseShiftDto,
  ): Promise<CloseShiftResponse> {
    return this.shifts.close(shiftId, body, user.userId);
  }
}
