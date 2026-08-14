"use client";

import { use } from "react";
import { hasPermission } from "@pos-apps/types";
import { useDashboardSession } from "@/components/templates/dashboard-frame";
import { ProductForm } from "../../../product-form";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const me = useDashboardSession();
  return (
    <ProductForm
      canMutate={hasPermission(me.permissions, "products", "update")}
      productId={productId}
    />
  );
}
