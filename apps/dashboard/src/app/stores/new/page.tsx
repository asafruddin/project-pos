"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { StoreForm } from "../../store-form";

export default function NewStorePage() {
  const me = useDashboardSession();
  return <StoreForm canEdit={hasPermission(me.permissions, "stores", "update")} />;
}
