import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateUnitRequest,
  UnitListResponse,
  UnitRecord,
  UpdateUnitRequest,
} from "@pos-apps/types";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, units, type UnitRow } from "../db/schema";

function toUnit(row: UnitRow): UnitRecord {
  return {
    unit_id: row.unitId,
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
export class UnitsService {
  async list(storeId: string): Promise<UnitListResponse> {
    const rows = await getDb()
      .select()
      .from(units)
      .where(eq(units.storeId, storeId))
      .orderBy(asc(units.name));
    return { units: rows.map(toUnit) };
  }

  async create(storeId: string, input: CreateUnitRequest): Promise<UnitRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "UNIT_INVALID",
        message: "Nama satuan wajib diisi.",
      });
    }
    try {
      const [row] = await getDb()
        .insert(units)
        .values({ storeId, name })
        .returning();
      return toUnit(row);
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async update(
    storeId: string,
    unitId: string,
    input: UpdateUnitRequest,
  ): Promise<UnitRecord> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "UNIT_INVALID",
        message: "Nama satuan wajib diisi.",
      });
    }
    await this.requireOwned(storeId, unitId);
    try {
      const [row] = await getDb()
        .update(units)
        .set({ name })
        .where(and(eq(units.unitId, unitId), eq(units.storeId, storeId)))
        .returning();
      if (!row) {
        throw new NotFoundException({
          code: "UNIT_NOT_FOUND",
          message: "Satuan tidak ditemukan.",
        });
      }
      return toUnit(row);
    } catch (err) {
      this.rethrowConflict(err);
    }
  }

  async remove(storeId: string, unitId: string): Promise<{ deleted: true }> {
    await this.requireOwned(storeId, unitId);
    const used = await getDb()
      .select({ productId: products.productId })
      .from(products)
      .where(eq(products.unitId, unitId))
      .limit(1);
    if (used[0]) {
      throw new ConflictException({
        code: "UNIT_IN_USE",
        message: "Satuan masih dipakai produk.",
      });
    }
    await getDb()
      .delete(units)
      .where(and(eq(units.unitId, unitId), eq(units.storeId, storeId)));
    return { deleted: true };
  }

  private async requireOwned(storeId: string, unitId: string): Promise<UnitRow> {
    const rows = await getDb()
      .select()
      .from(units)
      .where(and(eq(units.unitId, unitId), eq(units.storeId, storeId)))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException({
        code: "UNIT_NOT_FOUND",
        message: "Satuan tidak ditemukan.",
      });
    }
    return rows[0];
  }

  private rethrowConflict(err: unknown): never {
    const { code, constraint } = pgMeta(err);
    if (code === "23505" && constraint === "units_store_name_unique") {
      throw new ConflictException({
        code: "CATALOG_UNIT_CONFLICT",
        message: "Nama satuan sudah digunakan.",
      });
    }
    throw err;
  }
}
