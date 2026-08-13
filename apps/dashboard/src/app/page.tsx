"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ProductsPanel } from "./products-panel";

export default function HomePage() {
  const me = useDashboardSession();
  return (
    <ProductsPanel canMutate={hasPermission(me.permissions, "products", "update")} />
  );
}
