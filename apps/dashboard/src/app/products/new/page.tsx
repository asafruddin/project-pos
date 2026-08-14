"use client";

import { TableSkeleton } from "@pos-apps/ui/molecules";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ProductForm } from "../../product-form";

function NewProductForm() {
  const me = useDashboardSession();
  const params = useSearchParams();
  const parentId = params.get("parentId") ?? undefined;
  return (
    <ProductForm
      canMutate={hasPermission(me.permissions, "products", "update")}
      parentId={parentId}
    />
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <NewProductForm />
    </Suspense>
  );
}
