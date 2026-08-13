"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { StorePricesForm } from "../../store-prices-form";

export default function StorePricesPage() {
  const me = useDashboardSession();
  return (
    <StorePricesForm canEdit={hasPermission(me.permissions, "stores", "update")} />
  );
}
