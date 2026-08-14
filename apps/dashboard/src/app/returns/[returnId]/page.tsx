"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ReturnForm } from "../../return-form";

export default function ReturnDetailPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const { returnId } = use(params);
  const me = useDashboardSession();
  return (
    <ReturnForm
      returnId={returnId}
      canRefund={hasPermission(me.permissions, "returns", "approve")}
      canLinkExchange={hasPermission(me.permissions, "returns", "update")}
    />
  );
}
