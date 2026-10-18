import type { AssistantActionProposal } from "@pos-apps/types";
import { hasPermission } from "@pos-apps/types";

type ActionRequest = {
  method: "PATCH" | "PUT" | "POST";
  path: string;
  body: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Grant each confirmed action needs; mirrors the endpoint's `@RequirePermission`. */
export const ACTION_PERMISSION: Record<AssistantActionProposal["kind"], [string, string]> = {
  update_price: ["products", "update"],
  set_product_status: ["products", "update"],
  adjust_stock: ["inventory", "update"],
  create_promotion: ["promotions", "create"],
};

export function canApplyProposal(
  proposal: AssistantActionProposal,
  permissions: string[] | undefined,
): boolean {
  const [resource, action] = ACTION_PERMISSION[proposal.kind];
  return hasPermission(permissions, resource, action);
}

/**
 * Allowlist from proposal kind to the existing REST endpoint the normal UI uses.
 * The URL is built here, never taken from model output.
 */
export function proposalRequest(proposal: AssistantActionProposal): ActionRequest | null {
  switch (proposal.kind) {
    case "update_price":
      if (!UUID.test(proposal.product_id)) return null;
      return {
        method: "PATCH",
        path: `/catalog/products/${proposal.product_id}`,
        body: { price_minor: proposal.payload.price_minor },
      };
    case "set_product_status":
      if (!UUID.test(proposal.product_id)) return null;
      return {
        method: "PATCH",
        path: `/catalog/products/${proposal.product_id}`,
        body: { status: proposal.payload.status },
      };
    case "adjust_stock":
      if (!UUID.test(proposal.product_id)) return null;
      return {
        method: "PUT",
        path: `/catalog/products/${proposal.product_id}/stock`,
        body: { stock_qty: proposal.payload.stock_qty, reason: proposal.payload.reason },
      };
    case "create_promotion":
      return { method: "POST", path: "/promotions", body: proposal.payload };
    default:
      return null;
  }
}

export function isActionProposal(value: unknown): value is AssistantActionProposal {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof (value as { kind: unknown }).kind === "string" &&
    (value as { kind: string }).kind in ACTION_PERMISSION &&
    "payload" in value
  );
}
