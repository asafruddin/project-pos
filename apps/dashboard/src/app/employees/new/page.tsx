"use client";

import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { EmployeeForm } from "../../employee-form";

export default function NewEmployeePage() {
  const me = useDashboardSession();
  return <EmployeeForm actorRole={me.role} permissions={me.permissions} />;
}
