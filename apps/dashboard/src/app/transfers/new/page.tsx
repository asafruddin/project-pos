"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { TransferForm } from "../../transfer-form";

export default function NewTransferPage() {
  const me = useDashboardSession();
  return (
    <TransferForm canCreate={hasPermission(me.permissions, "transfers", "create")} />
  );
}
