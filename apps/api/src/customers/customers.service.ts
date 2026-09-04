import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { evaluateCustomerProfile, grantsFor, hasPermission } from "@pos-apps/domain";
import type {
  CreateCustomerRequest,
  CreateCustomerResponse,
  Customer,
  CustomerGroupListResponse,
  CustomerHistoryResponse,
  CustomerImportResult,
  CustomerListResponse,
  PriceOverride,
  Role,
  SetCustomerPriceRequest,
  SetGroupPriceRequest,
  SpreadsheetImportRowError,
  UpdateCustomerRequest,
} from "@pos-apps/types";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { importExceptionMessage } from "../common/spreadsheet-file";
import type { CustomerImportParsedRow } from "./customer-import";
import {
  customerGroupPrices,
  customerPrices,
  customers,
  loyaltyAccounts,
  saleReturns,
  saleReturnLines,
  sales,
  saleVoids,
} from "../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Actor = { role: Role; permissions?: string[] };

function canManageCustomers(actor: Actor): boolean {
  return hasPermission(grantsFor(actor), "customers", "update");
}

function mapCustomer(
  row: typeof customers.$inferSelect,
  extras: {
    price_overrides?: PriceOverride[];
    group_price_overrides?: PriceOverride[];
    loyalty_points?: number;
    loyalty_tier?: string | null;
    loyalty_lifetime_earned?: number;
  } = {},
): Customer {
  return {
    customer_id: row.customerId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    group_name: row.groupName,
    store_credit_minor: row.storeCreditMinor ?? 0,
    price_overrides: extras.price_overrides ?? [],
    group_price_overrides: extras.group_price_overrides ?? [],
    loyalty_points: extras.loyalty_points ?? 0,
    loyalty_tier: extras.loyalty_tier ?? null,
    loyalty_lifetime_earned: extras.loyalty_lifetime_earned ?? 0,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

@Injectable()
export class CustomersService {
  async list(q?: string): Promise<CustomerListResponse> {
    const term = q?.trim();
    const rows = term
      ? await getDb()
          .select()
          .from(customers)
          .where(
            or(
              ilike(customers.name, `%${escapeIlike(term)}%`),
              ilike(customers.phone, `%${escapeIlike(term)}%`),
              ilike(customers.email, `%${escapeIlike(term)}%`),
            ),
          )
          .orderBy(customers.name)
      : await getDb().select().from(customers).orderBy(customers.name);
    return { customers: await this.withPrices(rows) };
  }

  async listGroups(): Promise<CustomerGroupListResponse> {
    const rows = await getDb()
      .selectDistinct({ groupName: customers.groupName })
      .from(customers)
      .where(sql`${customers.groupName} is not null`);
    return {
      groups: rows
        .map((row) => row.groupName)
        .filter((name): name is string => !!name && name.trim().length > 0)
        .sort((a, b) => a.localeCompare(b)),
    };
  }

  async get(customerId: string): Promise<Customer> {
    const row = await this.load(customerId);
    if (!row) {
      throw new NotFoundException({
        code: "CUSTOMER_NOT_FOUND",
        message: "Pelanggan tidak ditemukan.",
      });
    }
    return (await this.withPrices([row]))[0]!;
  }

  async create(
    input: CreateCustomerRequest,
    actor: Actor,
  ): Promise<CreateCustomerResponse> {
    const parsed = evaluateCustomerProfile({
      name: input.name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      group_name: canManageCustomers(actor) ? input.group_name : null,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    if (input.customer_id && !UUID_RE.test(input.customer_id)) {
      throw new BadRequestException({
        code: "CUSTOMER_INVALID",
        message: "ID pelanggan tidak valid.",
      });
    }

    const db = getDb();
    if (input.customer_id) {
      const existing = await db
        .select()
        .from(customers)
        .where(eq(customers.customerId, input.customer_id))
        .limit(1);
      if (existing[0]) {
        return {
          customer: mapCustomer(existing[0]),
          warnings: [],
          already_accepted: true,
        };
      }
    }

    const warnings: Array<"DUPLICATE_PHONE"> = [];
    if (parsed.phone) {
      const dup = await db
        .select({ customerId: customers.customerId })
        .from(customers)
        .where(eq(customers.phone, parsed.phone))
        .limit(1);
      if (dup.length) warnings.push("DUPLICATE_PHONE");
    }

    try {
      const [row] = await db
        .insert(customers)
        .values({
          ...(input.customer_id ? { customerId: input.customer_id } : {}),
          name: parsed.name,
          phone: parsed.phone,
          email: parsed.email,
          notes: parsed.notes,
          groupName: parsed.group_name,
          ...(canManageCustomers(actor) &&
          Number.isInteger(input.store_credit_minor) &&
          (input.store_credit_minor ?? 0) >= 0
            ? { storeCreditMinor: input.store_credit_minor }
            : {}),
        })
        .returning();
      if (!row) {
        throw new BadRequestException({
          code: "CUSTOMER_INVALID",
          message: "Tidak dapat membuat pelanggan.",
        });
      }
      return { customer: mapCustomer(row), warnings, already_accepted: false };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (input.customer_id) {
        const raced = await this.load(input.customer_id);
        if (raced) {
          return {
            customer: mapCustomer(raced),
            warnings: [],
            already_accepted: true,
          };
        }
      }
      throw new BadRequestException({
        code: "CUSTOMER_INVALID",
        message: "Tidak dapat membuat pelanggan.",
      });
    }
  }

  async update(
    customerId: string,
    input: UpdateCustomerRequest,
    actor: Actor,
  ): Promise<Customer> {
    const current = await this.load(customerId);
    if (!current) {
      throw new NotFoundException({
        code: "CUSTOMER_NOT_FOUND",
        message: "Pelanggan tidak ditemukan.",
      });
    }
    const parsed = evaluateCustomerProfile({
      name: input.name ?? current.name,
      phone: input.phone === undefined ? current.phone : input.phone,
      email: input.email === undefined ? current.email : input.email,
      notes: input.notes === undefined ? current.notes : input.notes,
      group_name:
        canManageCustomers(actor)
          ? input.group_name === undefined
            ? current.groupName
            : input.group_name
          : current.groupName,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    if (
      canManageCustomers(actor) &&
      input.store_credit_minor !== undefined &&
      (!Number.isInteger(input.store_credit_minor) ||
        input.store_credit_minor < 0)
    ) {
      throw new BadRequestException({
        code: "CUSTOMER_INVALID",
        message: "Kredit toko harus bilangan bulat ≥ 0.",
      });
    }

    const [row] = await getDb()
      .update(customers)
      .set({
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        notes: parsed.notes,
        groupName: parsed.group_name,
        updatedAt: new Date(),
        ...(canManageCustomers(actor) &&
        typeof input.store_credit_minor === "number"
          ? { storeCreditMinor: input.store_credit_minor }
          : {}),
      })
      .where(eq(customers.customerId, customerId))
      .returning();
    if (!row) {
      throw new NotFoundException({
        code: "CUSTOMER_NOT_FOUND",
        message: "Pelanggan tidak ditemukan.",
      });
    }
    return (await this.withPrices([row]))[0]!;
  }

  async setPrice(
    customerId: string,
    input: SetCustomerPriceRequest,
    actor: Actor,
  ): Promise<Customer> {
    this.requireAdmin(actor);
    const current = await this.load(customerId);
    if (!current) {
      throw new NotFoundException({
        code: "CUSTOMER_NOT_FOUND",
        message: "Pelanggan tidak ditemukan.",
      });
    }
    const db = getDb();
    await db
      .delete(customerPrices)
      .where(
        and(
          eq(customerPrices.customerId, customerId),
          eq(customerPrices.productId, input.product_id),
        ),
      );
    if (input.price_minor !== null && input.price_minor !== undefined) {
      if (!Number.isInteger(input.price_minor) || input.price_minor < 0) {
        throw new BadRequestException({
          code: "CATALOG_INVALID_PRICE",
          message: "Harga pelanggan harus bilangan bulat ≥ 0.",
        });
      }
      try {
        await db.insert(customerPrices).values({
          customerId,
          productId: input.product_id,
          priceMinor: input.price_minor,
        });
      } catch {
        throw new BadRequestException({
          code: "CATALOG_PRODUCT_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }
    }
    return this.get(customerId);
  }

  async setGroupPrice(
    input: SetGroupPriceRequest,
    actor: Actor,
  ): Promise<{ group_name: string; product_id: string; price_minor: number | null }> {
    this.requireAdmin(actor);
    const group_name = input.group_name.trim();
    if (!group_name) {
      throw new BadRequestException({
        code: "CUSTOMER_INVALID",
        message: "Nama grup wajib diisi.",
      });
    }
    const db = getDb();
    await db
      .delete(customerGroupPrices)
      .where(
        and(
          eq(customerGroupPrices.groupName, group_name),
          eq(customerGroupPrices.productId, input.product_id),
        ),
      );
    if (input.price_minor !== null && input.price_minor !== undefined) {
      if (!Number.isInteger(input.price_minor) || input.price_minor < 0) {
        throw new BadRequestException({
          code: "CATALOG_INVALID_PRICE",
          message: "Harga grup harus bilangan bulat ≥ 0.",
        });
      }
      try {
        await db.insert(customerGroupPrices).values({
          groupName: group_name,
          productId: input.product_id,
          priceMinor: input.price_minor,
        });
      } catch {
        throw new BadRequestException({
          code: "CATALOG_PRODUCT_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }
    }
    return {
      group_name,
      product_id: input.product_id,
      price_minor: input.price_minor ?? null,
    };
  }

  async remove(customerId: string, actor: Actor): Promise<void> {
    if (!hasPermission(grantsFor(actor), "customers", "delete")) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Kasir tidak dapat menghapus pelanggan.",
      });
    }
    const current = await this.load(customerId);
    if (!current) {
      throw new NotFoundException({
        code: "CUSTOMER_NOT_FOUND",
        message: "Pelanggan tidak ditemukan.",
      });
    }
    await getDb().delete(customers).where(eq(customers.customerId, customerId));
  }

  async history(customerId: string): Promise<CustomerHistoryResponse> {
    const customer = await this.get(customerId);
    const db = getDb();
    const saleRows = await db
      .select({
        saleId: sales.saleId,
        completedAt: sales.completedAt,
        amountMinor: sales.amountMinor,
        voidedAt: saleVoids.voidedAt,
      })
      .from(sales)
      .leftJoin(saleVoids, eq(saleVoids.saleId, sales.saleId))
      .where(eq(sales.customerId, customerId))
      .orderBy(desc(sales.completedAt));

    const saleIds = saleRows.map((row) => row.saleId);
    const returnRows =
      saleIds.length === 0
        ? []
        : await db
            .select({
              returnId: saleReturns.returnId,
              saleId: saleReturns.saleId,
              status: saleReturns.status,
              createdAt: saleReturns.createdAt,
              amountMinor: sales.amountMinor,
            })
            .from(saleReturns)
            .innerJoin(sales, eq(sales.saleId, saleReturns.saleId))
            .where(inArray(saleReturns.saleId, saleIds))
            .orderBy(desc(saleReturns.createdAt));

    const lineSums =
      returnRows.length === 0
        ? []
        : await db
            .select({
              returnId: saleReturnLines.returnId,
              qty: saleReturnLines.qty,
              productId: saleReturnLines.productId,
            })
            .from(saleReturnLines)
            .where(
              inArray(
                saleReturnLines.returnId,
                returnRows.map((row) => row.returnId),
              ),
            );

    const saleLinePrice = new Map<string, number>();
    if (saleIds.length) {
      const fullSales = await db
        .select({ saleId: sales.saleId, lines: sales.lines })
        .from(sales)
        .where(inArray(sales.saleId, saleIds));
      for (const sale of fullSales) {
        for (const line of sale.lines) {
          saleLinePrice.set(`${sale.saleId}:${line.product_id}`, line.price_minor);
        }
      }
    }

    const returnAmount = new Map<string, number>();
    for (const line of lineSums) {
      const ret = returnRows.find((row) => row.returnId === line.returnId);
      if (!ret) continue;
      const price =
        saleLinePrice.get(`${ret.saleId}:${line.productId}`) ?? 0;
      returnAmount.set(
        line.returnId,
        (returnAmount.get(line.returnId) ?? 0) + price * line.qty,
      );
    }

    const historySales = saleRows.map((row) => ({
      sale_id: row.saleId,
      completed_at: row.completedAt.toISOString(),
      amount_minor: row.amountMinor,
      voided_at: row.voidedAt ? row.voidedAt.toISOString() : null,
    }));

    return {
      customer,
      sales: historySales,
      returns: returnRows.map((row) => ({
        return_id: row.returnId,
        sale_id: row.saleId,
        status: row.status,
        amount_minor: returnAmount.get(row.returnId) ?? 0,
        created_at: row.createdAt.toISOString(),
      })),
      total_spend_minor: historySales
        .filter((row) => !row.voided_at)
        .reduce((sum, row) => sum + row.amount_minor, 0),
    };
  }

  private requireAdmin(actor: Actor): void {
    if (!canManageCustomers(actor) && !hasPermission(grantsFor(actor), "customers", "delete")) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Kasir tidak dapat mengubah kredit atau harga pelanggan.",
      });
    }
  }

  private async withPrices(
    rows: Array<typeof customers.$inferSelect>,
  ): Promise<Customer[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.customerId);
    const groupNames = [
      ...new Set(
        rows
          .map((row) => row.groupName)
          .filter((name): name is string => !!name && name.trim().length > 0),
      ),
    ];
    const db = getDb();
    const priceRows = await db
      .select()
      .from(customerPrices)
      .where(inArray(customerPrices.customerId, ids));
    const groupRows = groupNames.length
      ? await db
          .select()
          .from(customerGroupPrices)
          .where(inArray(customerGroupPrices.groupName, groupNames))
      : [];
    const byCustomer = new Map<string, PriceOverride[]>();
    for (const row of priceRows) {
      const list = byCustomer.get(row.customerId) ?? [];
      list.push({ product_id: row.productId, price_minor: row.priceMinor });
      byCustomer.set(row.customerId, list);
    }
    const byGroup = new Map<string, PriceOverride[]>();
    for (const row of groupRows) {
      const list = byGroup.get(row.groupName) ?? [];
      list.push({ product_id: row.productId, price_minor: row.priceMinor });
      byGroup.set(row.groupName, list);
    }
    const accountRows = await db
      .select()
      .from(loyaltyAccounts)
      .where(inArray(loyaltyAccounts.customerId, ids));
    const byAccount = new Map(
      accountRows.map((row) => [row.customerId, row] as const),
    );
    return rows.map((row) => {
      const account = byAccount.get(row.customerId);
      return mapCustomer(row, {
        price_overrides: byCustomer.get(row.customerId) ?? [],
        group_price_overrides: row.groupName
          ? (byGroup.get(row.groupName) ?? [])
          : [],
        loyalty_points: account?.pointsBalance ?? 0,
        loyalty_tier: account?.tier ?? null,
        loyalty_lifetime_earned: account?.lifetimeEarned ?? 0,
      });
    });
  }

  async importCustomers(
    rows: CustomerImportParsedRow[],
    parseErrors: SpreadsheetImportRowError[],
    actor: Actor,
  ): Promise<CustomerImportResult> {
    const errors: SpreadsheetImportRowError[] = [...parseErrors];
    let created = 0;
    let updated = 0;
    const updatedKeys: string[] = [];
    const keyToId = new Map<string, string>();
    const ambiguous = new Set<string>();

    const phones = [
      ...new Set(rows.map((row) => row.phone).filter((v): v is string => Boolean(v))),
    ];
    const emails = [
      ...new Set(
        rows
          .filter((row) => !row.phone && row.email)
          .map((row) => row.email)
          .filter((v): v is string => Boolean(v)),
      ),
    ];

    if (phones.length > 0) {
      const found = await getDb()
        .select({
          customerId: customers.customerId,
          phone: customers.phone,
        })
        .from(customers)
        .where(inArray(customers.phone, phones));
      const byPhone = new Map<string, string[]>();
      for (const row of found) {
        if (!row.phone) continue;
        const list = byPhone.get(row.phone) ?? [];
        list.push(row.customerId);
        byPhone.set(row.phone, list);
      }
      for (const [phone, ids] of byPhone) {
        const matchKey = `phone:${phone}`;
        if (ids.length > 1) ambiguous.add(matchKey);
        else if (ids[0]) keyToId.set(matchKey, ids[0]);
      }
    }

    if (emails.length > 0) {
      const found = await getDb()
        .select({
          customerId: customers.customerId,
          email: customers.email,
        })
        .from(customers)
        .where(inArray(customers.email, emails));
      const byEmail = new Map<string, string[]>();
      for (const row of found) {
        if (!row.email) continue;
        const list = byEmail.get(row.email) ?? [];
        list.push(row.customerId);
        byEmail.set(row.email, list);
      }
      for (const [email, ids] of byEmail) {
        const matchKey = `email:${email}`;
        if (ids.length > 1) ambiguous.add(matchKey);
        else if (ids[0]) keyToId.set(matchKey, ids[0]);
      }
    }

    for (const row of rows) {
      const matchKey = row.phone ? `phone:${row.phone}` : `email:${row.email ?? ""}`;
      if (ambiguous.has(matchKey)) {
        errors.push({
          row: row.row,
          key: row.key,
          message: row.phone
            ? `Telepon "${row.phone}" dipakai lebih dari satu pelanggan.`
            : `Email "${row.email}" dipakai lebih dari satu pelanggan.`,
        });
        continue;
      }

      try {
        const existingId = keyToId.get(matchKey);
        if (existingId) {
          await this.update(
            existingId,
            {
              name: row.name,
              phone: row.phone,
              email: row.email,
              ...(row.notes !== undefined ? { notes: row.notes } : {}),
              ...(row.groupName !== undefined ? { group_name: row.groupName } : {}),
              ...(row.storeCreditMinor !== undefined
                ? { store_credit_minor: row.storeCreditMinor }
                : {}),
            },
            actor,
          );
          updated += 1;
          if (!updatedKeys.includes(row.key)) updatedKeys.push(row.key);
        } else {
          const createdRow = await this.create(
            {
              name: row.name,
              phone: row.phone,
              email: row.email,
              notes: row.notes,
              group_name: row.groupName,
              store_credit_minor: row.storeCreditMinor,
            },
            actor,
          );
          created += 1;
          keyToId.set(matchKey, createdRow.customer.customer_id);
        }
      } catch (err) {
        errors.push({
          row: row.row,
          key: row.key,
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

  private async load(customerId: string) {
    const rows = await getDb()
      .select()
      .from(customers)
      .where(eq(customers.customerId, customerId))
      .limit(1);
    return rows[0] ?? null;
  }
}
