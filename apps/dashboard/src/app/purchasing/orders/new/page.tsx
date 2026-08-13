"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { PurchaseOrderForm } from "../../../purchase-order-form";

export default function NewPurchaseOrderPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "purchases", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Kasir tidak memiliki alur pembelian. Penerimaan barang ada di cerita berikutnya.
      </p>
    );
  }
  return <PurchaseOrderForm />;
}
