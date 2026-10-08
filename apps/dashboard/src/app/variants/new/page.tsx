"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { VariantGroupForm } from "../../variant-group-form";

export default function NewVariantPage() {
  const me = useDashboardSession();
  return (
    <VariantGroupForm
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
    />
  );
}
