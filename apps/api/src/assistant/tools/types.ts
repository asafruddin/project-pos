import type { z } from "zod";
import type { AuthUser } from "../../auth/jwt.strategy";
import type { CustomersService } from "../../customers/customers.service";
import type { InventoryService } from "../../inventory/inventory.service";
import type { ReportsService } from "../../reports/reports.service";
import type { ProductLookup } from "../product-lookup";

/**
 * Plain tool shape accepted by AI SDK `streamText({ tools })`. Kept free of runtime
 * `ai` imports so tools stay unit-testable under Jest (the SDK is ESM-only).
 */
export type AssistantTool<I = any, O = unknown> = {
  description: string;
  inputSchema: z.ZodType<I>;
  execute: (input: I) => Promise<O>;
};

export type AssistantTools = Record<string, AssistantTool>;

export type AssistantDeps = {
  reports: Pick<ReportsService, "summary" | "products" | "cashiers" | "inventory">;
  inventory: Pick<InventoryService, "overview">;
  customers: Pick<CustomersService, "list">;
  products: Pick<ProductLookup, "search" | "get">;
};

export type AssistantViewer = AuthUser;
