"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { OpnamePanel } from "../opname-panel";

export default function OpnamePage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "inventory", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda tidak memiliki alur opname. Gunakan Ikhtisar stok untuk melihat jumlah.
      </p>
    );
  }
  return (
    <OpnamePanel
      canMutate={
        hasPermission(me.permissions, "inventory", "create") ||
        hasPermission(me.permissions, "inventory", "update")
      }
      canApprove={hasPermission(me.permissions, "inventory", "approve")}
    />
  );
}
