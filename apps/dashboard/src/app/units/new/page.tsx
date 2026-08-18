"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { UnitForm } from "../../unit-form";

export default function NewUnitPage() {
  const me = useDashboardSession();
  return (
    <UnitForm
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
