"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { LoyaltyPanel } from "../loyalty-panel";

export default function LoyaltyPage() {
  const me = useDashboardSession();
  return <LoyaltyPanel canEdit={hasPermission(me.permissions, "loyalty", "update")} />;
}
