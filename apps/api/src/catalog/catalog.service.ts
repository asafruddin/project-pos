import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { adjustStock } from "@pos-apps/domain";
import type { Product, ProductListResponse } from "@pos-apps/types";
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, type ProductRow } from "../db/schema";

function toProduct(row: ProductRow): Product {
  return {
    product_id: row.productId,
    name: row.name,
    price_minor: row.priceMinor,
    stock_qty: row.stockQty,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CatalogService {
  async list(): Promise<ProductListResponse> {
    const rows = await getDb().select().from(products).orderBy(asc(products.name));
    return { products: rows.map(toProduct) };
  }

  async create(input: {
    name: string;
    price_minor: number;
    stock_qty: number;
  }): Promise<Product> {
    const stock = adjustStock(input.stock_qty);
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

    const [row] = await getDb()
      .insert(products)
      .values({
        name: input.name.trim(),
        priceMinor: input.price_minor,
        stockQty: stock.stock_qty,
      })
      .returning();

    return toProduct(row);
  }

  async update(
    productId: string,
    input: { name?: string; price_minor?: number },
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

    const [row] = await getDb()
      .update(products)
      .set({
        name: input.name?.trim() ?? existing.name,
        priceMinor: input.price_minor ?? existing.priceMinor,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, productId))
      .returning();

    return toProduct(row);
  }

  async setStock(productId: string, stock_qty: number): Promise<Product> {
    await this.requireProduct(productId);
    const stock = adjustStock(stock_qty);
    if (!stock.ok) {
      throw new BadRequestException({
        code: stock.code,
        message: stock.message,
      });
    }

    const [row] = await getDb()
      .update(products)
      .set({
        stockQty: stock.stock_qty,
        updatedAt: new Date(),
      })
      .where(eq(products.productId, productId))
      .returning();

    return toProduct(row);
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
