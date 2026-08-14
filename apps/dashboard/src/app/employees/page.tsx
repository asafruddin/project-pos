"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { EmployeesPanel } from "../employees-panel";

export default function EmployeesPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "users", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        API menolak user-admin dari token kasir. Hide/show UI saja tidak cukup.
      </p>
    );
  }
  return <EmployeesPanel permissions={me.permissions} />;
}
