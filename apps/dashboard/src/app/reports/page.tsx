"use client";

import { useDashboardSession } from "@/components/dashboard-frame";
import { ReportsPanel } from "../reports-panel";

export default function ReportsPage() {
  const me = useDashboardSession();
  return <ReportsPanel role={me.role} permissions={me.permissions} />;
}
