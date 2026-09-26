import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  CreateCustomerResponse,
  Customer,
  CustomerGroupListResponse,
  CustomerHistoryResponse,
  CustomerListResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CustomersService } from "./customers.service";
import {
  CreateCustomerDto,
  SetCustomerPriceDto,
  SetGroupPriceDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("q") q?: string,
  ): Promise<CustomerListResponse> {
    return this.customers.list(q, user.storeId);
  }

  @Get("groups")
  listGroups(
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerGroupListResponse> {
    return this.customers.listGroups(user.storeId);
  }

  @Put("group-prices")
  @RequirePermission("customers", "update")
  @UseGuards(PermissionsGuard)
  setGroupPrice(
    @Body() body: SetGroupPriceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ group_name: string; product_id: string; price_minor: number | null }> {
    return this.customers.setGroupPrice(
      { ...body, price_minor: body.price_minor ?? null },
      user,
    );
  }

  @Post()
  @RequirePermission("customers", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: CreateCustomerDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CreateCustomerResponse> {
    return this.customers.create(body, user);
  }

  @Get(":customerId/history")
  history(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerHistoryResponse> {
    return this.customers.history(customerId, user.storeId);
  }

  @Put(":customerId/prices")
  @RequirePermission("customers", "update")
  @UseGuards(PermissionsGuard)
  setPrice(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() body: SetCustomerPriceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Customer> {
    return this.customers.setPrice(
      customerId,
      { ...body, price_minor: body.price_minor ?? null },
      user,
    );
  }

  @Get(":customerId")
  get(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Customer> {
    return this.customers.get(customerId, user.storeId);
  }

  @Patch(":customerId")
  @RequirePermission("customers", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Body() body: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Customer> {
    return this.customers.update(customerId, body, user);
  }

  @Delete(":customerId")
  @RequirePermission("customers", "delete")
  @UseGuards(PermissionsGuard)
  remove(
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.customers.remove(customerId, user);
  }
}
