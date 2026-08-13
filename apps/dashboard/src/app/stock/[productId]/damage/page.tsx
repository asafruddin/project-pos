"use client";

import { Suspense, use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/dashboard-frame";
import { StockDamageForm } from "../../../stock-damage-form";
import { TableSkeleton } from "@/components/ui/skeleton";

function DamageFormBody({ productId }: { productId: string }) {
  const me = useDashboardSession();
  return (
    <StockDamageForm
      productId={productId}
      canMutate={hasPermission(me.permissions, "inventory", "update")}
    />
  );
}

export default function StockDamagePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <DamageFormBody productId={productId} />
    </Suspense>
  );
}
