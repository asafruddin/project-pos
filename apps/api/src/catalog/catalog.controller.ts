import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { Product, ProductListResponse } from "@pos-apps/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("catalog/products")
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(): Promise<ProductListResponse> {
    return this.catalog.list();
  }

  @Post()
  @Roles("catalog_admin")
  @UseGuards(RolesGuard)
  create(@Body() body: CreateProductDto): Promise<Product> {
    return this.catalog.create(body);
  }

  @Patch(":productId")
  @Roles("catalog_admin")
  @UseGuards(RolesGuard)
  update(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: UpdateProductDto,
  ): Promise<Product> {
    return this.catalog.update(productId, body);
  }

  @Put(":productId/stock")
  @Roles("catalog_admin")
  @UseGuards(RolesGuard)
  setStock(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: AdjustStockDto,
  ): Promise<Product> {
    return this.catalog.setStock(productId, body.stock_qty);
  }
}
