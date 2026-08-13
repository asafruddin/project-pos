"use client";

import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { SupplierForm } from "../../../supplier-form";

export default function NewSupplierPage() {
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "purchases", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Kasir tidak memiliki alur pembelian. Penerimaan barang ada di cerita berikutnya.
      </p>
    );
  }
  return <SupplierForm />;
}
