"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { StockOverviewPanel } from "../stock-overview-panel";

export default function StockPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "inventory", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki alur ikhtisar stok.
      </p>
    );
  }
  return (
    <StockOverviewPanel canMutate={hasPermission(me.permissions, "inventory", "update")} />
  );
}
