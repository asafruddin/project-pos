"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { VariantGroupForm } from "../../../variant-group-form";

export default function EditVariantPage({
  params,
}: {
  params: Promise<{ variantGroupId: string }>;
}) {
  const { variantGroupId } = use(params);
  const me = useDashboardSession();
  return (
    <VariantGroupForm
      canCreate={hasPermission(me.permissions, "products", "create")}
      canEdit={hasPermission(me.permissions, "products", "update")}
      variantGroupId={variantGroupId}
    />
  );
}
