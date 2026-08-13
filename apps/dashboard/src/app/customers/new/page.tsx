"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { CustomerForm } from "../../customer-form";

export default function NewCustomerPage() {
  const me = useDashboardSession();
  return (
    <CustomerForm canDelete={hasPermission(me.permissions, "customers", "delete")} />
  );
}
