"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { PurchasingPanel } from "../purchasing-panel";

export default function PurchasingPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "purchases", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Kasir tidak memiliki alur pembelian. Penerimaan barang ada di cerita berikutnya.
      </p>
    );
  }
  return <PurchasingPanel />;
}
