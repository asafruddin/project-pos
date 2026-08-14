"use client";

import { use } from "react";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { EmployeeForm } from "../../../employee-form";

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const me = useDashboardSession();
  return (
    <EmployeeForm
      actorRole={me.role}
      permissions={me.permissions}
      userId={userId}
    />
  );
}
