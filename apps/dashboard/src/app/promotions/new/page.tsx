"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { PromotionForm } from "../../promotion-form";

export default function NewPromotionPage() {
  const me = useDashboardSession();
  return (
    <PromotionForm canEdit={hasPermission(me.permissions, "promotions", "update")} />
  );
}
