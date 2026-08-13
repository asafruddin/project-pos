import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adjustStock, resolveSellingPrice } from "@pos-apps/domain";
import type {
  AdjustStockRequest,
  CreateProductRequest,
  Product,
  ProductImage,
  ProductListResponse,
  ProductStatus,
  UpdateProductRequest,
} from "@pos-apps/types";
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import { MediaService } from "../media/media.service";
import {
  brands,
  categories,
  products,
  storePrices,
  type BrandRow,
  type CategoryRow,
  type ProductRow,
} from "../db/schema";

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toProduct(
  row: ProductRow,
  extras?: {
    category_name?: string | null;
    brand_name?: string | null;
    images?: ProductImage[];
  },
): Product {
  const images = extras?.images ?? [];
  return {
    product_id: row.productId,
    name: row.name,
    price_minor: row.priceMinor,
    stock_qty: row.stockQty,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    description: row.description ?? null,
    status: row.status ?? "active",
    cost_minor: row.costMinor ?? null,
    compare_at_minor: row.compareAtMinor ?? null,
    min_qty: row.minQty ?? null,
    max_qty: row.maxQty ?? null,
    track_stock: row.trackStock ?? true,
    parent_id: row.parentId ?? null,
    category_id: row.categoryId ?? null,
    category_name: extras?.category_name ?? null,
    brand_id: row.brandId ?? null,
    brand_name: extras?.brand_name ?? null,
    tags: row.tags ?? [],
    images,
    has_primary_image: images.some((image) => image.is_primary),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function pgMeta(err: unknown): { code?: string; constraint?: string } {
  if (typeof err !== "object" || err === null) return {};
  const e = err as { code?: string; constraint?: string };
  return { code: e.code, constraint: e.constraint };
}

function rethrowCatalogWriteError(err: unknown): never {
  const { code, constraint } = pgMeta(err);
  if (code === "23503") {
    throw new BadRequestException({
      code: "CATALOG_INVALID_PARENT",
      message: "Produk induk tidak ditemukan.",
    });
  }
  if (code === "23505") {
    if (constraint === "categories_name_unique") {
      throw new ConflictException({
        code: "CATALOG_CATEGORY_CONFLICT",
        message: "Nama kategori sudah digunakan.",
      });
    }
    if (constraint === "brands_name_unique") {
      throw new ConflictException({
        code: "CATALOG_BRAND_CONFLICT",
        message: "Nama merek sudah digunakan.",
      });
    }
    throw new ConflictException({
      code: "CATALOG_SKU_CONFLICT",
      message: "SKU sudah digunakan.",
    });
  }
  throw err;
}

async function assertParent(
  parentId: string | null | undefined,
  selfId?: string,
): Promise<void> {
  const id = parentId ?? null;
  if (!id) return;
  if (selfId && id === selfId) {
    throw new BadRequestException({
      code: "CATALOG_INVALID_PARENT",
      message: "Produk tidak dapat menjadi induk dirinya sendiri.",
    });
  }
  const rows = await getDb()
    .select({ productId: products.productId })
    .from(products)
    .where(eq(products.productId, id))
    .limit(1);
  if (!rows[0]) {
    throw new BadRequestException({
      code: "CATALOG_INVALID_PARENT",
      message: "Produk induk tidak ditemukan.",
    });
  }
}

async function ensureNamed(
  tx: {
    select: (...args: never[]) => {
      from: (table: typeof categories | typeof brands) => {
        where: (cond: unknown) => {
          limit: (n: number) => Promise<Array<CategoryRow | BrandRow>>;
        };
      };
    };
    insert: (table: typeof categories | typeof brands) => {
      values: (v: { name: string }) => {
        returning: () => Promise<Array<CategoryRow | BrandRow>>;
      };
    };
  },
  table: typeof categories | typeof brands,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = blankToNull(name ?? null);
  if (!trimmed) return null;
  const existing = await tx
    .select()
    .from(table)
    .where(eq(table.name, trimmed))
    .limit(1);
  if (existing[0]) {
    return "categoryId" in existing[0]
      ? (existing[0] as CategoryRow).categoryId
      : (existing[0] as BrandRow).brandId;
  }
  const [row] = await tx.insert(table).values({ name: trimmed }).returning();
  return "categoryId" in row
    ? (row as CategoryRow).categoryId
    : (row as BrandRow).brandId;
}

@Injectable()
export class CatalogService {
  constructor(private readonly media: MediaService) {}

  async list(storeId?: string): Promise<ProductListResponse> {
    const rows = await getDb()
      .select({
        product: products,
        categoryName: categories.name,
        brandName: brands.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.categoryId))
      .leftJoin(brands, eq(products.brandId, brands.brandId))
      .orderBy(asc(products.name));
    const imagesByProduct = await this.media.imagesFor(
      rows.map((row) => row.product.productId),
    );
    const storePriceByProduct = new Map<string, number>();
    if (storeId) {
      const overrides = await getDb()
        .select()
        .from(storePrices)
        .where(eq(storePrices.storeId, storeId));
      for (const row of overrides) {
        if (row.priceMinor != null) {
          storePriceByProduct.set(row.productId, row.priceMinor);
        }
      }
    }
    return {
      products: rows.map((row) => {
        const mapped = toProduct(row.product, {
          category_name: row.categoryName,
          brand_name: row.brandName,
          images: imagesByProduct.get(row.product.productId) ?? [],
        });
        return {
          ...mapped,
          price_minor: resolveSellingPrice({
            catalog_price_minor: mapped.price_minor,
            store_price_minor: storePriceByProduct.get(row.product.productId),
          }),
        };
      }),
    };
  }

  async create(input: CreateProductRequest, actorId?: string): Promise<Product> {
    const stock = adjustStock({
      currentQty: 0,
      targetQty: input.stock_qty,
      reason: "initial_stock",
    });
    if (!stock.ok) {
      throw new BadRequestException({
        code: stock.code,
        message: stock.message,
      });
    }
    if (!Number.isInteger(input.price_minor) || input.price_minor < 0) {
      throw new BadRequestException({
        code: "CATALOG_INVALID_PRICE",
        message: "Harga harus bilangan bulat ≥ 0.",
      });
    }
    const status: ProductStatus = input.status ?? "active";
    if (status !== "active" && status !== "inactive") {
      throw new BadRequestException({
        code: "CATALOG_INVALID_STATUS",
        message: "Status produk tidak valid.",
      });
    }
    await assertParent(input.parent_id);

    try {
      return await getDb().transaction(async (tx) => {
        const categoryId = await ensureNamed(
          tx as never,
          categories,
          input.category_name,
        );
        const brandId = await ensureNamed(tx as never, brands, input.brand_name);
        const [row] = await tx
          .insert(products)
          .values({
            name: input.name.trim(),
            priceMinor: input.price_minor,
            stockQty: stock.stock_qty,
            sku: blankToNull(input.sku),
            barcode: blankToNull(input.barcode),
            description: blankToNull(input.description),
            status,
            costMinor: input.cost_minor ?? null,
            compareAtMinor: input.compare_at_minor ?? null,
            minQty: input.min_qty ?? null,
            maxQty: input.max_qty ?? null,
            trackStock: input.track_stock ?? true,
            parentId: input.parent_id ?? null,
            categoryId,
            brandId,
            tags: input.tags ?? [],
          })
          .returning();

        await insertStockMovement(tx, {
          productId: row.productId,
          qtyDelta: stock.qty_delta,
          bucket: "sellable",
          reason: stock.reason,
          sourceType: "adjust",
          actorId: actorId ?? null,
        });

        return toProduct(row, {
          category_name: blankToNull(input.category_name),
          brand_name: blankToNull(input.brand_name),
          images: [],
        });
      });
    } catch (err) {
      rethrowCatalogWriteError(err);
    }
  }

  async update(productId: string, input: UpdateProductRequest): Promise<Product> {
    const existing = await this.requireProduct(productId);
    if (input.price_minor !== undefined) {
      if (!Number.isInteger(input.price_minor) || input.price_minor < 0) {
        throw new BadRequestException({
          code: "CATALOG_INVALID_PRICE",
          message: "Harga harus bilangan bulat ≥ 0.",
        });
      }
    }
    if (input.status && input.status !== "active" && input.status !== "inactive") {
      throw new BadRequestException({
        code: "CATALOG_INVALID_STATUS",
        message: "Status produk tidak valid.",
      });
    }
    const nextParent =
      input.parent_id !== undefined ? input.parent_id : existing.parentId;
    await assertParent(nextParent, productId);

    try {
      return await getDb().transaction(async (tx) => {
        const categoryId =
          input.category_name !== undefined
            ? await ensureNamed(tx as never, categories, input.category_name)
            : existing.categoryId;
        const brandId =
          input.brand_name !== undefined
            ? await ensureNamed(tx as never, brands, input.brand_name)
            : existing.brandId;
        const [row] = await tx
          .update(products)
          .set({
            name: input.name?.trim() ?? existing.name,
            priceMinor: input.price_minor ?? existing.priceMinor,
            sku: input.sku !== undefined ? blankToNull(input.sku) : existing.sku,
            barcode:
              input.barcode !== undefined ? blankToNull(input.barcode) : existing.barcode,
            description:
              input.description !== undefined
                ? blankToNull(input.description)
                : existing.description,
            status: input.status ?? existing.status,
            costMinor: input.cost_minor !== undefined ? input.cost_minor : existing.costMinor,
            compareAtMinor:
              input.compare_at_minor !== undefined
                ? input.compare_at_minor
                : existing.compareAtMinor,
            minQty: input.min_qty !== undefined ? input.min_qty : existing.minQty,
            maxQty: input.max_qty !== undefined ? input.max_qty : existing.maxQty,
            trackStock: input.track_stock ?? existing.trackStock,
            parentId: input.parent_id !== undefined ? input.parent_id : existing.parentId,
            categoryId,
            brandId,
            tags: input.tags ?? existing.tags,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, productId))
          .returning();
        return this.withImages(row);
      });
    } catch (err) {
      rethrowCatalogWriteError(err);
    }
  }

  async setStock(
    productId: string,
    input: AdjustStockRequest,
    actorId?: string,
  ): Promise<Product> {
    return getDb().transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1)
        .for("update");
      const existing = rows[0];
      if (!existing) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }

      const stock = adjustStock({
        currentQty: existing.stockQty,
        targetQty: input.stock_qty,
        reason: input.reason,
      });
      if (!stock.ok) {
        throw new BadRequestException({
          code: stock.code,
          message: stock.message,
        });
      }

      if (stock.qty_delta !== 0) {
        await insertStockMovement(tx, {
          productId,
          qtyDelta: stock.qty_delta,
          bucket: "sellable",
          reason: stock.reason,
          sourceType: "adjust",
          actorId: actorId ?? null,
        });
      }

      const [row] = await tx
        .update(products)
        .set({
          stockQty: stock.stock_qty,
          updatedAt: new Date(),
        })
        .where(eq(products.productId, productId))
        .returning();

      return this.withImages(row);
    });
  }

  private async withImages(row: ProductRow): Promise<Product> {
    const map = await this.media.imagesFor([row.productId]);
    return toProduct(row, { images: map.get(row.productId) ?? [] });
  }

  private async requireProduct(productId: string): Promise<ProductRow> {
    const rows = await getDb()
      .select()
      .from(products)
      .where(eq(products.productId, productId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
    return row;
  }
}
