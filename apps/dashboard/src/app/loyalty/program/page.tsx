"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { LoyaltyProgramForm } from "../../loyalty-program-form";

export default function LoyaltyProgramPage() {
  const me = useDashboardSession();
  return (
    <LoyaltyProgramForm canEdit={hasPermission(me.permissions, "loyalty", "update")} />
  );
}
