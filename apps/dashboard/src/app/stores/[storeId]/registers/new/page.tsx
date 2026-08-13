"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { RegisterForm } from "../../../../register-form";

export default function NewRegisterPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = use(params);
  const me = useDashboardSession();
  return (
    <RegisterForm
      canEdit={hasPermission(me.permissions, "stores", "update")}
      storeId={storeId}
    />
  );
}
