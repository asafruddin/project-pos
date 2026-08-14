"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ProductsPanel } from "../products-panel";

export default function ProductsPage() {
  const me = useDashboardSession();
  return (
    <ProductsPanel canMutate={hasPermission(me.permissions, "products", "update")} />
  );
}
