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
  ProductUnitConversion,
  UpdateProductRequest,
  UpsertUnitConversionRequest,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import { MediaService } from "../media/media.service";
import {
  brands,
  categories,
  products,
  productUnitConversions,
  stockMovements,
  storePrices,
  units,
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
    unit_name?: string | null;
    images?: ProductImage[];
    unit_conversion?: ProductUnitConversion | null;
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
    unit_id: row.unitId ?? null,
    unit_name: extras?.unit_name ?? null,
    unit_conversion: extras?.unit_conversion ?? null,
    tags: row.tags ?? [],
    images,
    has_primary_image: images.some((image) => image.is_primary),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
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
    if (
      constraint === "categories_name_unique" ||
      constraint === "categories_store_name_unique"
    ) {
      throw new ConflictException({
        code: "CATALOG_CATEGORY_CONFLICT",
        message: "Nama kategori sudah digunakan.",
      });
    }
    if (
      constraint === "units_store_name_unique" ||
      constraint === "units_name_unique"
    ) {
      throw new ConflictException({
        code: "CATALOG_UNIT_CONFLICT",
        message: "Nama satuan sudah digunakan.",
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

type NamedTx = {
  select: (...args: never[]) => {
    from: (table: typeof brands | typeof categories | typeof units) => {
      where: (cond: unknown) => {
        limit: (n: number) => Promise<Array<Record<string, unknown>>>;
      };
    };
  };
  insert: (table: typeof brands | typeof categories | typeof units) => {
    values: (v: Record<string, unknown>) => {
      returning: () => Promise<Array<Record<string, unknown>>>;
    };
  };
};

async function ensureBrand(
  tx: NamedTx,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = blankToNull(name ?? null);
  if (!trimmed) return null;
  const existing = await tx
    .select()
    .from(brands)
    .where(eq(brands.name, trimmed))
    .limit(1);
  if (existing[0]) return existing[0].brandId as string;
  const [row] = await tx.insert(brands).values({ name: trimmed }).returning();
  return row.brandId as string;
}

async function ensureCategory(
  tx: NamedTx,
  storeId: string,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = blankToNull(name ?? null);
  if (!trimmed) return null;
  const existing = await tx
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.name, trimmed)))
    .limit(1);
  if (existing[0]) return existing[0].categoryId as string;
  const [row] = await tx
    .insert(categories)
    .values({ storeId, name: trimmed })
    .returning();
  return row.categoryId as string;
}

async function ensureUnit(
  tx: NamedTx,
  storeId: string,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = blankToNull(name ?? null);
  if (!trimmed) return null;
  const existing = await tx
    .select()
    .from(units)
    .where(and(eq(units.storeId, storeId), eq(units.name, trimmed)))
    .limit(1);
  if (existing[0]) return existing[0].unitId as string;
  const [row] = await tx
    .insert(units)
    .values({ storeId, name: trimmed })
    .returning();
  return row.unitId as string;
}

@Injectable()
export class CatalogService {
  constructor(private readonly media: MediaService) {}

  private async sellableByProduct(
    storeId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!productIds.length) return result;
    if (storeId === STORE_1_ID) {
      const rows = await getDb()
        .select({
          productId: products.productId,
          stockQty: products.stockQty,
        })
        .from(products)
        .where(inArray(products.productId, productIds));
      for (const row of rows) {
        result.set(row.productId, row.stockQty);
      }
      return result;
    }
    const sums = await getDb()
      .select({
        productId: stockMovements.productId,
        qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}), 0)`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          eq(stockMovements.bucket, "sellable"),
          inArray(stockMovements.productId, productIds),
        ),
      )
      .groupBy(stockMovements.productId);
    for (const row of sums) {
      result.set(row.productId, toQty(row.qty));
    }
    for (const id of productIds) {
      if (!result.has(id)) result.set(id, 0);
    }
    return result;
  }

  private async conversionsFor(
    toProductIds: string[],
    storeId: string = STORE_1_ID,
  ): Promise<Map<string, ProductUnitConversion>> {
    const map = new Map<string, ProductUnitConversion>();
    if (!toProductIds.length) return map;
    const fromProducts = products;
    const fromUnits = units;
    const rows = await getDb()
      .select({
        conversionId: productUnitConversions.conversionId,
        fromProductId: productUnitConversions.fromProductId,
        toProductId: productUnitConversions.toProductId,
        fromQty: productUnitConversions.fromQty,
        toQty: productUnitConversions.toQty,
        fromName: fromProducts.name,
        fromUnitName: fromUnits.name,
      })
      .from(productUnitConversions)
      .innerJoin(
        fromProducts,
        eq(productUnitConversions.fromProductId, fromProducts.productId),
      )
      .leftJoin(fromUnits, eq(fromProducts.unitId, fromUnits.unitId))
      .where(inArray(productUnitConversions.toProductId, toProductIds));
    const sellable = await this.sellableByProduct(
      storeId,
      rows.map((row) => row.fromProductId),
    );
    for (const row of rows) {
      map.set(row.toProductId, {
        conversion_id: row.conversionId,
        from_product_id: row.fromProductId,
        from_product_name: row.fromName,
        from_unit_name: row.fromUnitName ?? null,
        from_stock_qty: sellable.get(row.fromProductId) ?? 0,
        from_qty: row.fromQty,
        to_qty: row.toQty,
      });
    }
    return map;
  }

  async list(storeId?: string): Promise<ProductListResponse> {
    const stockStore = storeId || STORE_1_ID;
    const rows = await getDb()
      .select({
        product: products,
        categoryName: categories.name,
        brandName: brands.name,
        unitName: units.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.categoryId))
      .leftJoin(brands, eq(products.brandId, brands.brandId))
      .leftJoin(units, eq(products.unitId, units.unitId))
      .orderBy(asc(products.name));
    const imagesByProduct = await this.media.imagesFor(
      rows.map((row) => row.product.productId),
    );
    const conversionByTo = await this.conversionsFor(
      rows.map((row) => row.product.productId),
      stockStore,
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
          unit_name: row.unitName,
          images: imagesByProduct.get(row.product.productId) ?? [],
          unit_conversion: conversionByTo.get(row.product.productId) ?? null,
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

  async create(
    input: CreateProductRequest,
    actorId?: string,
    storeId: string = STORE_1_ID,
  ): Promise<Product> {
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
        const categoryId = await ensureCategory(
          tx as never,
          storeId,
          input.category_name,
        );
        const brandId = await ensureBrand(tx as never, input.brand_name);
        const unitId = await ensureUnit(tx as never, storeId, input.unit_name);
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
            unitId,
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
          unit_name: blankToNull(input.unit_name),
          images: [],
          unit_conversion: null,
        });
      });
    } catch (err) {
      rethrowCatalogWriteError(err);
    }
  }

  async update(
    productId: string,
    input: UpdateProductRequest,
    storeId: string = STORE_1_ID,
  ): Promise<Product> {
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
            ? await ensureCategory(tx as never, storeId, input.category_name)
            : existing.categoryId;
        const brandId =
          input.brand_name !== undefined
            ? await ensureBrand(tx as never, input.brand_name)
            : existing.brandId;
        const unitId =
          input.unit_name !== undefined
            ? await ensureUnit(tx as never, storeId, input.unit_name)
            : existing.unitId;
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
            unitId,
            tags: input.tags ?? existing.tags,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, productId))
          .returning();
        const names = await tx
          .select({
            categoryName: categories.name,
            brandName: brands.name,
            unitName: units.name,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.categoryId))
          .leftJoin(brands, eq(products.brandId, brands.brandId))
          .leftJoin(units, eq(products.unitId, units.unitId))
          .where(eq(products.productId, productId))
          .limit(1);
        const map = await this.media.imagesFor([row.productId]);
        const conversionByTo = await this.conversionsFor([row.productId], storeId);
        return toProduct(row, {
          category_name: names[0]?.categoryName ?? null,
          brand_name: names[0]?.brandName ?? null,
          unit_name: names[0]?.unitName ?? null,
          images: map.get(row.productId) ?? [],
          unit_conversion: conversionByTo.get(row.productId) ?? null,
        });
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

  private async withImages(
    row: ProductRow,
    storeId: string = STORE_1_ID,
  ): Promise<Product> {
    const map = await this.media.imagesFor([row.productId]);
    const names = await getDb()
      .select({
        categoryName: categories.name,
        brandName: brands.name,
        unitName: units.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.categoryId))
      .leftJoin(brands, eq(products.brandId, brands.brandId))
      .leftJoin(units, eq(products.unitId, units.unitId))
      .where(eq(products.productId, row.productId))
      .limit(1);
    const conversionByTo = await this.conversionsFor([row.productId], storeId);
    return toProduct(row, {
      category_name: names[0]?.categoryName ?? null,
      brand_name: names[0]?.brandName ?? null,
      unit_name: names[0]?.unitName ?? null,
      images: map.get(row.productId) ?? [],
      unit_conversion: conversionByTo.get(row.productId) ?? null,
    });
  }

  async setUnitConversion(
    toProductId: string,
    input: UpsertUnitConversionRequest,
    storeId: string = STORE_1_ID,
  ): Promise<Product> {
    const toProduct = await this.requireProduct(toProductId);
    if (input.from_product_id === toProductId) {
      throw new BadRequestException({
        code: "CONVERSION_INVALID",
        message: "Produk sumber dan tujuan tidak boleh sama.",
      });
    }
    const fromProduct = await this.requireProduct(input.from_product_id);
    const fromQty = input.from_qty ?? 1;
    if (!Number.isInteger(fromQty) || fromQty < 1) {
      throw new BadRequestException({
        code: "CONVERSION_INVALID",
        message: "Jumlah kemasan harus bilangan bulat ≥ 1.",
      });
    }
    if (!Number.isInteger(input.to_qty) || input.to_qty < 1) {
      throw new BadRequestException({
        code: "CONVERSION_INVALID",
        message: "Jumlah pcs harus bilangan bulat ≥ 1.",
      });
    }
    if (!toProduct.trackStock || !fromProduct.trackStock) {
      throw new BadRequestException({
        code: "CONVERSION_INVALID",
        message: "Kedua produk harus melacak stok.",
      });
    }

    try {
      const existing = await getDb()
        .select()
        .from(productUnitConversions)
        .where(eq(productUnitConversions.toProductId, toProductId))
        .limit(1);
      if (existing[0]) {
        await getDb()
          .update(productUnitConversions)
          .set({
            fromProductId: input.from_product_id,
            fromQty,
            toQty: input.to_qty,
            updatedAt: new Date(),
          })
          .where(eq(productUnitConversions.toProductId, toProductId));
      } else {
        await getDb().insert(productUnitConversions).values({
          fromProductId: input.from_product_id,
          toProductId,
          fromQty,
          toQty: input.to_qty,
        });
      }
    } catch (err) {
      const { code } = pgMeta(err);
      if (code === "23503") {
        throw new BadRequestException({
          code: "CONVERSION_INVALID",
          message: "Produk sumber tidak ditemukan.",
        });
      }
      throw err;
    }

    return this.withImages(toProduct, storeId);
  }

  async deleteUnitConversion(
    toProductId: string,
    storeId: string = STORE_1_ID,
  ): Promise<Product> {
    const toProduct = await this.requireProduct(toProductId);
    await getDb()
      .delete(productUnitConversions)
      .where(eq(productUnitConversions.toProductId, toProductId));
    return this.withImages(toProduct, storeId);
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
