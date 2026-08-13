"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { SupplierForm } from "../../../../supplier-form";

export default function EditSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { supplierId } = use(params);
  const me = useDashboardSession();
  if (!hasPermission(me.permissions, "purchases", "view")) {
    return (
      <p className="text-sm text-muted-foreground">
        Kasir tidak memiliki alur pembelian. Penerimaan barang ada di cerita berikutnya.
      </p>
    );
  }
  return <SupplierForm supplierId={supplierId} />;
}
