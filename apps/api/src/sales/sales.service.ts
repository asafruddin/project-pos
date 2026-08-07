import { Injectable } from "@nestjs/common";
import type { SalesListItem, SalesListResponse } from "@pos-apps/types";
import { and, desc, gte, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { sales } from "../db/schema";

@Injectable()
export class SalesService {
  async listToday(): Promise<SalesListResponse> {
    const db = getDb();
    const start = startOfUtcDay(new Date());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const rows = await db
      .select()
      .from(sales)
      .where(and(gte(sales.completedAt, start), lt(sales.completedAt, end)))
      .orderBy(desc(sales.completedAt));

    const items: SalesListItem[] = rows.map((r) => ({
      sale_id: r.saleId,
      completed_at: r.completedAt.toISOString(),
      amount_minor: r.amountMinor,
    }));

    const daily_total_minor = items.reduce((sum, s) => sum + s.amount_minor, 0);

    return { sales: items, daily_total_minor };
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
