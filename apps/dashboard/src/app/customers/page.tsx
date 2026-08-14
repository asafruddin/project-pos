"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { CustomersPanel } from "../customers-panel";

export default function CustomersPage() {
  const me = useDashboardSession();
  return (
    <CustomersPanel canDelete={hasPermission(me.permissions, "customers", "delete")} />
  );
}
