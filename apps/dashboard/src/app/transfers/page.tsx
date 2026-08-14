"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { TransfersPanel } from "../transfers-panel";

export default function TransfersPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "transfers", "view")) {
    return (
      <p className="text-sm text-muted-foreground">Anda tidak memiliki izin transfer.</p>
    );
  }
  return (
    <TransfersPanel
      canCreate={hasPermission(me.permissions, "transfers", "create")}
      canAdvance={hasPermission(me.permissions, "transfers", "update")}
      canApprove={hasPermission(me.permissions, "transfers", "approve")}
    />
  );
}
