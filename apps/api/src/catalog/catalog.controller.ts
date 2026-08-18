import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { grantsFor, hasPermission } from "@pos-apps/domain";
import type { Product, ProductImage, ProductListResponse } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { MediaService } from "../media/media.service";
import { CatalogService } from "./catalog.service";
import { AdjustStockDto } from "./dto/adjust-stock.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import {
  ReorderProductImagesDto,
  UpdateProductImageDto,
  UploadProductImageDto,
} from "./dto/product-image.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpsertUnitConversionDto } from "./dto/upsert-unit-conversion.dto";

@Controller("catalog/products")
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ProductListResponse> {
    const overlayStore =
      user.role === "cashier" || user.role === "supervisor"
        ? user.storeId
        : undefined;
    const result = await this.catalog.list(overlayStore);
    if (!hasPermission(grantsFor(user), "products", "view_cost")) {
      return {
        products: result.products.map((product) => ({
          ...product,
          cost_minor: undefined,
        })),
      };
    }
    return result;
  }

  @Post()
  @RequirePermission("products", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: CreateProductDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Product> {
    return this.catalog.create(
      body,
      user.userId,
      user.storeId ?? "00000000-0000-4000-8000-000000000001",
    );
  }

  @Patch(":productId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Product> {
    return this.catalog.update(
      productId,
      body,
      user.storeId ?? "00000000-0000-4000-8000-000000000001",
    );
  }

  @Put(":productId/unit-conversion")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  setUnitConversion(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: UpsertUnitConversionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Product> {
    return this.catalog.setUnitConversion(
      productId,
      body,
      user.storeId ?? "00000000-0000-4000-8000-000000000001",
    );
  }

  @Delete(":productId/unit-conversion")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  deleteUnitConversion(
    @Param("productId", ParseUUIDPipe) productId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Product> {
    return this.catalog.deleteUnitConversion(
      productId,
      user.storeId ?? "00000000-0000-4000-8000-000000000001",
    );
  }

  @Put(":productId/stock")
  @RequirePermission("inventory", "update")
  @UseGuards(PermissionsGuard)
  setStock(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: AdjustStockDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Product> {
    return this.catalog.setStock(productId, body, user.userId);
  }

  @Get(":productId/images/:imageId/file")
  @Header("Cache-Control", "private, max-age=60")
  async imageFile(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ): Promise<StreamableFile> {
    const file = await this.media.getFile(productId, imageId);
    return new StreamableFile(file.bytes, {
      type: file.mimeType,
      disposition: "inline",
    });
  }

  @Post(":productId/images")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadImage(
    @Param("productId", ParseUUIDPipe) productId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
    @Body() body: UploadProductImageDto,
  ): Promise<ProductImage> {
    return this.media.upload(productId, file, body.alt_text);
  }

  @Patch(":productId/images/reorder")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  reorderImages(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: ReorderProductImagesDto,
  ): Promise<ProductImage[]> {
    return this.media.reorder(productId, body.image_ids);
  }

  @Patch(":productId/images/:imageId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  updateImage(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() body: UpdateProductImageDto,
  ): Promise<ProductImage> {
    return this.media.updateImage(productId, imageId, body);
  }

  @Delete(":productId/images/:imageId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  async deleteImage(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ): Promise<{ deleted: true }> {
    await this.media.remove(productId, imageId);
    return { deleted: true };
  }
}
