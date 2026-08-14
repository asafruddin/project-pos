"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { OpnameForm } from "../../opname-form";

export default function NewOpnamePage() {
  const me = useDashboardSession();
  return (
    <OpnameForm
      canMutate={
        hasPermission(me.permissions, "inventory", "create") ||
        hasPermission(me.permissions, "inventory", "update")
      }
    />
  );
}
