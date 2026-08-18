"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { CategoriesPanel } from "../categories-panel";

export default function CategoriesPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "products", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki izin untuk melihat kategori.
      </p>
    );
  }
  return (
    <CategoriesPanel
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
