"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { UnitsPanel } from "../units-panel";

export default function UnitsPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "products", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki izin untuk melihat satuan.
      </p>
    );
  }
  return (
    <UnitsPanel
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
