"use client";

import type { ReactNode } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { ReportSubnav } from "./report-shared";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  const me = useDashboardSession();
  return (
    <div className="flex flex-col gap-4">
      <ReportSubnav
        showStock={hasPermission(me.permissions, "reports", "view_financial")}
      />
      {children}
    </div>
  );
}
