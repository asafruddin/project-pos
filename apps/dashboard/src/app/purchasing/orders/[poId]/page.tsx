"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { PurchaseOrderDetailForm } from "../../../purchase-order-detail";

export default function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = use(params);
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "purchases", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Kasir tidak memiliki alur pembelian. Penerimaan barang ada di cerita berikutnya.
      </p>
    );
  }
  return <PurchaseOrderDetailForm poId={poId} />;
}
