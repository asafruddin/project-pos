import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateSupplierRequest,
  Supplier,
  SupplierImportResult,
  SupplierListResponse,
  SpreadsheetImportRowError,
  UpdateSupplierRequest,
} from "@pos-apps/types";
import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "../db/client";
import { importExceptionMessage } from "../common/spreadsheet-file";
import type { SupplierImportParsedRow } from "./supplier-import";
import {
  products,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "../db/schema";

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

@Injectable()
export class SupplierService {
  async list(q?: string): Promise<SupplierListResponse> {
    const term = q?.trim();
    const rows = term
      ? await getDb()
          .select()
          .from(suppliers)
          .where(
            or(
              ilike(suppliers.name, `%${term.replace(/[%_]/g, "\\$&")}%`),
              ilike(suppliers.contactName, `%${term.replace(/[%_]/g, "\\$&")}%`),
              ilike(suppliers.phone, `%${term.replace(/[%_]/g, "\\$&")}%`),
            ),
          )
          .orderBy(suppliers.name)
      : await getDb().select().from(suppliers).orderBy(suppliers.name);

    return {
      suppliers: rows.map((row) => ({
        supplier_id: row.supplierId,
        name: row.name,
        contact_name: row.contactName,
        phone: row.phone,
        email: row.email,
        payment_terms: row.paymentTerms,
        notes: row.notes,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })),
    };
  }

  async get(supplierId: string): Promise<Supplier> {
    const detail = await this.load(supplierId);
    if (!detail) {
      throw new NotFoundException({
        code: "SUPPLIER_NOT_FOUND",
        message: "Pemasok tidak ditemukan.",
      });
    }
    return detail;
  }

  async create(input: CreateSupplierRequest): Promise<Supplier> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "SUPPLIER_INVALID",
        message: "Nama pemasok wajib diisi.",
      });
    }
    const supplierId = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(suppliers)
        .values({
          name,
          contactName: blankToNull(input.contact_name),
          phone: blankToNull(input.phone),
          email: blankToNull(input.email),
          paymentTerms: blankToNull(input.payment_terms),
          notes: blankToNull(input.notes),
        })
        .returning();
      if (!row) {
        throw new BadRequestException({
          code: "SUPPLIER_INVALID",
          message: "Gagal membuat pemasok.",
        });
      }
      await this.replaceProducts(tx, row.supplierId, input.products ?? []);
      return row.supplierId;
    });
    return this.get(supplierId);
  }

  async update(
    supplierId: string,
    input: UpdateSupplierRequest,
  ): Promise<Supplier> {
    await getDb().transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.supplierId, supplierId))
        .limit(1)
        .for("update");
      if (!existing[0]) {
        throw new NotFoundException({
          code: "SUPPLIER_NOT_FOUND",
          message: "Pemasok tidak ditemukan.",
        });
      }
      const patch: Partial<typeof suppliers.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name != null) {
        const name = input.name.trim();
        if (!name) {
          throw new BadRequestException({
            code: "SUPPLIER_INVALID",
            message: "Nama pemasok wajib diisi.",
          });
        }
        patch.name = name;
      }
      if (input.contact_name !== undefined) {
        patch.contactName = blankToNull(input.contact_name);
      }
      if (input.phone !== undefined) patch.phone = blankToNull(input.phone);
      if (input.email !== undefined) patch.email = blankToNull(input.email);
      if (input.payment_terms !== undefined) {
        patch.paymentTerms = blankToNull(input.payment_terms);
      }
      if (input.notes !== undefined) patch.notes = blankToNull(input.notes);
      await tx
        .update(suppliers)
        .set(patch)
        .where(eq(suppliers.supplierId, supplierId));
      if (input.products) {
        await this.replaceProducts(tx, supplierId, input.products);
      }
    });
    return this.get(supplierId);
  }

  private async replaceProducts(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    supplierId: string,
    productsInput: Array<{ product_id: string; cost_minor?: number | null }>,
  ): Promise<void> {
    const ids = [...new Set(productsInput.map((p) => p.product_id))];
    if (ids.length) {
      const found = await tx
        .select({ productId: products.productId })
        .from(products)
        .where(inArray(products.productId, ids));
      if (found.length !== ids.length) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }
    }
    await tx
      .delete(supplierProducts)
      .where(eq(supplierProducts.supplierId, supplierId));
    if (!productsInput.length) return;
    await tx.insert(supplierProducts).values(
      productsInput.map((p) => ({
        supplierId,
        productId: p.product_id,
        costMinor: p.cost_minor ?? null,
      })),
    );
  }

  private async load(supplierId: string): Promise<Supplier | null> {
    const db = getDb();
    const headers = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.supplierId, supplierId))
      .limit(1);
    const header = headers[0];
    if (!header) return null;

    const supplied = await db
      .select({
        productId: supplierProducts.productId,
        costMinor: supplierProducts.costMinor,
        name: products.name,
      })
      .from(supplierProducts)
      .innerJoin(products, eq(products.productId, supplierProducts.productId))
      .where(eq(supplierProducts.supplierId, supplierId));

    const history = await db
      .select({
        poId: purchaseOrders.poId,
        status: purchaseOrders.status,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId))
      .orderBy(desc(purchaseOrders.createdAt));

    return {
      supplier_id: header.supplierId,
      name: header.name,
      contact_name: header.contactName,
      phone: header.phone,
      email: header.email,
      payment_terms: header.paymentTerms,
      notes: header.notes,
      products: supplied.map((row) => ({
        product_id: row.productId,
        name: row.name,
        cost_minor: row.costMinor,
      })),
      purchase_orders: history.map((row) => ({
        po_id: row.poId,
        status: row.status,
        created_at: row.createdAt.toISOString(),
      })),
      created_at: header.createdAt.toISOString(),
      updated_at: header.updatedAt.toISOString(),
    };
  }

  async importSuppliers(
    rows: SupplierImportParsedRow[],
    parseErrors: SpreadsheetImportRowError[],
  ): Promise<SupplierImportResult> {
    const errors: SpreadsheetImportRowError[] = [...parseErrors];
    let created = 0;
    let updated = 0;
    const updatedKeys: string[] = [];
    const nameToId = new Map<string, string>();
    const ambiguous = new Set<string>();

    const names = [...new Set(rows.map((row) => row.name))];
    if (names.length > 0) {
      const found = await getDb()
        .select({
          supplierId: suppliers.supplierId,
          name: suppliers.name,
        })
        .from(suppliers)
        .where(inArray(suppliers.name, names));
      const byName = new Map<string, string[]>();
      for (const row of found) {
        const list = byName.get(row.name) ?? [];
        list.push(row.supplierId);
        byName.set(row.name, list);
      }
      for (const [name, ids] of byName) {
        if (ids.length > 1) ambiguous.add(name);
        else if (ids[0]) nameToId.set(name, ids[0]);
      }
    }

    for (const row of rows) {
      if (ambiguous.has(row.name)) {
        errors.push({
          row: row.row,
          key: row.name,
          message: `Nama pemasok "${row.name}" dipakai lebih dari satu data.`,
        });
        continue;
      }
      try {
        const existingId = nameToId.get(row.name);
        if (existingId) {
          await this.update(existingId, {
            name: row.name,
            ...(row.contactName !== undefined ? { contact_name: row.contactName } : {}),
            ...(row.phone !== undefined ? { phone: row.phone } : {}),
            ...(row.email !== undefined ? { email: row.email } : {}),
            ...(row.paymentTerms !== undefined
              ? { payment_terms: row.paymentTerms }
              : {}),
            ...(row.notes !== undefined ? { notes: row.notes } : {}),
          });
          updated += 1;
          if (!updatedKeys.includes(row.name)) updatedKeys.push(row.name);
        } else {
          const createdRow = await this.create({
            name: row.name,
            contact_name: row.contactName,
            phone: row.phone,
            email: row.email,
            payment_terms: row.paymentTerms,
            notes: row.notes,
          });
          created += 1;
          nameToId.set(row.name, createdRow.supplier_id);
        }
      } catch (err) {
        errors.push({
          row: row.row,
          key: row.name,
          message: importExceptionMessage(err),
        });
      }
    }

    return {
      created,
      updated,
      updated_keys: updatedKeys,
      errors,
    };
  }
}
