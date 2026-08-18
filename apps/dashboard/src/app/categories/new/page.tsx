"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { CategoryForm } from "../../category-form";

export default function NewCategoryPage() {
  const me = useDashboardSession();
  return (
    <CategoryForm
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
