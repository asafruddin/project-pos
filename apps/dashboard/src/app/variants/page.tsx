"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { VariantsPanel } from "../variants-panel";

export default function VariantsPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "products", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki izin untuk melihat varian.
      </p>
    );
  }
  return (
    <VariantsPanel
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
