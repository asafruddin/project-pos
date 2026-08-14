"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { StoresPanel } from "../stores-panel";

export default function StoresPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "stores", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Checkout tidak memilih toko per baris.
      </p>
    );
  }
  return <StoresPanel canEdit={hasPermission(me.permissions, "stores", "update")} />;
}
