"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ProductImportForm } from "../../product-import-form";

export default function ProductImportPage() {
  const me = useDashboardSession();
  return (
    <ProductImportForm
      canMutate={hasPermission(me.permissions, "products", "update")}
    />
  );
}
