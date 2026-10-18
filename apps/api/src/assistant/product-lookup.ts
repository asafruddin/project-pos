import { Injectable } from "@nestjs/common";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "../db/client";
import { products } from "../db/schema";

export type AssistantProduct = {
  product_id: string;
  name: string;
  sku: string | null;
  status: "active" | "inactive";
  price_minor: number;
  stock_qty: number;
  track_stock: boolean;
};

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

const columns = {
  productId: products.productId,
  name: products.name,
  sku: products.sku,
  status: products.status,
  priceMinor: products.priceMinor,
  stockQty: products.stockQty,
  trackStock: products.trackStock,
};

function toAssistantProduct(row: {
  productId: string;
  name: string;
  sku: string | null;
  status: "active" | "inactive";
  priceMinor: number;
  stockQty: number;
  trackStock: boolean;
}): AssistantProduct {
  return {
    product_id: row.productId,
    name: row.name,
    sku: row.sku,
    status: row.status,
    price_minor: row.priceMinor,
    stock_qty: row.stockQty,
    track_stock: row.trackStock,
  };
}

/** Read-only, store-scoped product queries for assistant tools. */
@Injectable()
export class ProductLookup {
  async search(
    storeId: string,
    query: string,
    limit: number,
  ): Promise<AssistantProduct[]> {
    const term = `%${escapeIlike(query.trim())}%`;
    const rows = await getDb()
      .select(columns)
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          or(ilike(products.name, term), ilike(products.sku, term)),
        ),
      )
      .orderBy(asc(products.name))
      .limit(limit);
    return rows.map(toAssistantProduct);
  }

  async get(storeId: string, productId: string): Promise<AssistantProduct | null> {
    const rows = await getDb()
      .select(columns)
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.productId, productId)))
      .limit(1);
    return rows[0] ? toAssistantProduct(rows[0]) : null;
  }
}
