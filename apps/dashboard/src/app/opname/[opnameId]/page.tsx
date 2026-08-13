"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { OpnameCountForm } from "../../opname-count-form";

export default function OpnameDetailPage({
  params,
}: {
  params: Promise<{ opnameId: string }>;
}) {
  const { opnameId } = use(params);
  const me = useDashboardSession();
  return (
    <OpnameCountForm
      opnameId={opnameId}
      canMutate={
        hasPermission(me.permissions, "inventory", "create") ||
        hasPermission(me.permissions, "inventory", "update")
      }
      canApprove={hasPermission(me.permissions, "inventory", "approve")}
    />
  );
}
