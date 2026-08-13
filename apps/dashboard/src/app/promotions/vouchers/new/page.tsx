"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { VoucherForm } from "../../../voucher-form";

export default function NewVoucherPage() {
  const me = useDashboardSession();
  return (
    <VoucherForm canEdit={hasPermission(me.permissions, "promotions", "update")} />
  );
}
