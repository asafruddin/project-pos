"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { StoreEditForm } from "../../../store-edit-form";

export default function EditStorePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = use(params);
  const me = useDashboardSession();
  return (
    <StoreEditForm
      canEdit={hasPermission(me.permissions, "stores", "update")}
      storeId={storeId}
    />
  );
}
