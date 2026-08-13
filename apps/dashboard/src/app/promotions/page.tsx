"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { PromotionsPanel } from "../promotions-panel";

export default function PromotionsPage() {
  const me = useDashboardSession();
  return (
    <PromotionsPanel canEdit={hasPermission(me.permissions, "promotions", "update")} />
  );
}
