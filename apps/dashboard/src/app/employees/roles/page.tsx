"use client";

import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { EmployeeRolesForm } from "../../employee-roles-form";

export default function EmployeeRolesPage() {
  const me = useDashboardSession();
  return (
    <EmployeeRolesForm actorRole={me.role} permissions={me.permissions} />
  );
}
