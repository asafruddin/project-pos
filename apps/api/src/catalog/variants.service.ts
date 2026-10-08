import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateVariantGroupRequest,
  UpdateVariantGroupRequest,
  VariantGroupListResponse,
  VariantGroupRecord,
} from "@pos-apps/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, variantGroups, type VariantGroupRow } from "../db/schema";

function toRecord(row: VariantGroupRow): VariantGroupRecord {
  return {
    variant_group_id: row.variantGroupId,
    store_id: row.storeId,
    name: row.name,
    options: row.options ?? [],
    created_at: row.createdAt.toISOString(),
  };
}

function pgMeta(err: unknown): { code?: string; constraint?: string } {
  if (typeof err !== "object" || err === null) return {};
  const e = err as { code?: string; constraint?: string };
  return { code: e.code, constraint: e.constraint };
}

/** Trim, drop blanks and case-insensitive duplicates, keep first spelling and order. */
export function normalizeOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function invalid(message: string): never {
  throw new BadRequestException({ code: "VARIANT_GROUP_INVALID", message });
}

@Injectable()
export class VariantsService {
  async list(storeId: string): Promise<VariantGroupListResponse> {
    const rows = await getDb()
      .select()
      .from(variantGroups)
      .where(eq(variantGroups.storeId, storeId))
      .orderBy(asc(variantGroups.name));
    return { variant_groups: rows.map(toRecord) };
  }

  async create(
    storeId: string,
    input: CreateVariantGroupRequest,
  ): Promise<VariantGroupRecord> {
    const name = input.name.trim();
    const options = normalizeOptions(input.options);
    if (!name) invalid("Nama varian wajib diisi.");
    if (options.length === 0) invalid("Isi minimal satu pilihan varian.");
    try {
      const [row] = await getDb()
        .insert(variantGroups)
        .values({ storeId, name, options })
        .returning();
      return toRecord(row);
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async update(
    storeId: string,
    variantGroupId: string,
    input: UpdateVariantGroupRequest,
  ): Promise<VariantGroupRecord> {
    const name = input.name.trim();
    const options = normalizeOptions(input.options);
    if (!name) invalid("Nama varian wajib diisi.");
    if (options.length === 0) invalid("Isi minimal satu pilihan varian.");
    const existing = await this.requireOwned(storeId, variantGroupId);

    const kept = new Set(options.map((o) => o.toLowerCase()));
    const removed = (existing.options ?? []).filter((o) => !kept.has(o.toLowerCase()));
    if (removed.length > 0) {
      await this.assertOptionsUnused(storeId, existing.name, removed);
    }

    try {
      return await getDb().transaction(async (tx) => {
        const [row] = await tx
          .update(variantGroups)
          .set({ name, options })
          .where(
            and(
              eq(variantGroups.variantGroupId, variantGroupId),
              eq(variantGroups.storeId, storeId),
            ),
          )
          .returning();
        if (name !== existing.name) {
          await tx
            .update(products)
            .set({
              variantGroups: sql`array_replace(${products.variantGroups}, ${existing.name}, ${name})`,
            })
            .where(
              and(
                eq(products.storeId, storeId),
                sql`${existing.name} = ANY(${products.variantGroups})`,
              ),
            );
        }
        return toRecord(row);
      });
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async remove(
    storeId: string,
    variantGroupId: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.requireOwned(storeId, variantGroupId);
    const used = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          sql`${existing.name} = ANY(${products.variantGroups})`,
        ),
      )
      .limit(1);
    if (used[0]) {
      throw new ConflictException({
        code: "VARIANT_GROUP_IN_USE",
        message: "Varian masih dipakai produk.",
      });
    }
    await getDb()
      .delete(variantGroups)
      .where(
        and(
          eq(variantGroups.variantGroupId, variantGroupId),
          eq(variantGroups.storeId, storeId),
        ),
      );
    return { deleted: true };
  }

  /** Reject removing an option that a product variant still uses. */
  private async assertOptionsUnused(
    storeId: string,
    groupName: string,
    removed: string[],
  ): Promise<void> {
    const db = getDb();
    const parents = await db
      .select({ productId: products.productId })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          sql`${groupName} = ANY(${products.variantGroups})`,
        ),
      );
    if (parents.length === 0) return;
    const lowered = new Set(removed.map((o) => o.toLowerCase()));
    const children = await db
      .select({ values: products.variantValues })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          inArray(
            products.parentId,
            parents.map((p) => p.productId),
          ),
        ),
      );
    for (const child of children) {
      const hit = (child.values ?? []).find((v) => lowered.has(v.toLowerCase()));
      if (hit) {
        throw new ConflictException({
          code: "VARIANT_OPTION_IN_USE",
          message: `Pilihan "${hit}" masih dipakai produk.`,
        });
      }
    }
  }

  private async requireOwned(
    storeId: string,
    variantGroupId: string,
  ): Promise<VariantGroupRow> {
    const rows = await getDb()
      .select()
      .from(variantGroups)
      .where(
        and(
          eq(variantGroups.variantGroupId, variantGroupId),
          eq(variantGroups.storeId, storeId),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "VARIANT_GROUP_NOT_FOUND",
        message: "Varian tidak ditemukan.",
      });
    }
    return rows[0];
  }

  private rethrowConflict(err: unknown): never {
    const { code, constraint } = pgMeta(err);
    if (code === "23505" && constraint === "variant_groups_store_name_unique") {
      throw new ConflictException({
        code: "VARIANT_GROUP_CONFLICT",
        message: "Nama varian sudah digunakan.",
      });
    }
    throw err;
  }
}
