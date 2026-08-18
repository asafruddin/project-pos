import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CategoryListResponse,
  CategoryRecord,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@pos-apps/types";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { categories, products, type CategoryRow } from "../db/schema";

function toCategory(row: CategoryRow): CategoryRecord {
  return {
    category_id: row.categoryId,
    store_id: row.storeId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

function pgMeta(err: unknown): { code?: string; constraint?: string } {
  if (typeof err !== "object" || err === null) return {};
  const e = err as { code?: string; constraint?: string };
  return { code: e.code, constraint: e.constraint };
}

@Injectable()
export class CategoriesService {
  async list(storeId: string): Promise<CategoryListResponse> {
    const rows = await getDb()
      .select()
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(asc(categories.name));
    return { categories: rows.map(toCategory) };
  }

  async create(
    storeId: string,
    input: CreateCategoryRequest,
  ): Promise<CategoryRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "CATEGORY_INVALID",
        message: "Nama kategori wajib diisi.",
      });
    }
    try {
      const [row] = await getDb()
        .insert(categories)
        .values({ storeId, name })
        .returning();
      return toCategory(row);
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async update(
    storeId: string,
    categoryId: string,
    input: UpdateCategoryRequest,
  ): Promise<CategoryRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "CATEGORY_INVALID",
        message: "Nama kategori wajib diisi.",
      });
    }
    await this.requireOwned(storeId, categoryId);
    try {
      const [row] = await getDb()
        .update(categories)
        .set({ name })
        .where(
          and(eq(categories.categoryId, categoryId), eq(categories.storeId, storeId)),
        )
        .returning();
      if (!row) {
        throw new NotFoundException({
          code: "CATEGORY_NOT_FOUND",
          message: "Kategori tidak ditemukan.",
        });
      }
      return toCategory(row);
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async remove(storeId: string, categoryId: string): Promise<{ deleted: true }> {
    await this.requireOwned(storeId, categoryId);
    const used = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .limit(1);
    if (used[0]) {
      throw new ConflictException({
        code: "CATEGORY_IN_USE",
        message: "Kategori masih dipakai produk.",
      });
    }
    await getDb()
      .delete(categories)
      .where(
        and(eq(categories.categoryId, categoryId), eq(categories.storeId, storeId)),
      );
    return { deleted: true };
  }

  private async requireOwned(storeId: string, categoryId: string): Promise<CategoryRow> {
    const rows = await getDb()
      .select()
      .from(categories)
      .where(
        and(eq(categories.categoryId, categoryId), eq(categories.storeId, storeId)),
      )
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "CATEGORY_NOT_FOUND",
        message: "Kategori tidak ditemukan.",
      });
    }
    return rows[0];
  }

  private rethrowConflict(err: unknown): never {
    const { code, constraint } = pgMeta(err);
    if (
      code === "23505" &&
      (constraint === "categories_store_name_unique" ||
        constraint === "categories_name_unique")
    ) {
      throw new ConflictException({
        code: "CATALOG_CATEGORY_CONFLICT",
        message: "Nama kategori sudah digunakan.",
      });
    }
    throw err;
  }
}
