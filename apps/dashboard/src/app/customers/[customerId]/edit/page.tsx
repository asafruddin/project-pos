"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { CustomerForm } from "../../../customer-form";

export default function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const me = useDashboardSession();
  return (
    <CustomerForm
      canDelete={hasPermission(me.permissions, "customers", "delete")}
      customerId={customerId}
    />
  );
}
