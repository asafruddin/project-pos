"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ReturnsPanel } from "../returns-panel";

export default function ReturnsPage() {
  const me = useDashboardSession();
  return (
    <ReturnsPanel
      canRefund={hasPermission(me.permissions, "returns", "approve")}
      canLinkExchange={hasPermission(me.permissions, "returns", "update")}
    />
  );
}
