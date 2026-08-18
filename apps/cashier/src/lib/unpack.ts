import {
  patchCatalogStocks,
  type CatalogProductRecord,
} from "@pos-apps/local-db";
import type { ApiErrorBody, UnpackUnitResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

export function canOfferUnpack(
  product: CatalogProductRecord,
  online: boolean,
  catalog?: CatalogProductRecord[],
): boolean {
  if (!online) return false;
  if (!product.unitConversion) return false;
  const packId = product.unitConversion.fromProductId;
  const packRow = catalog?.find((row) => row.productId === packId);
  const packStock = packRow?.stockQty ?? product.unitConversion.fromStockQty;
  return packStock > 0;
}

/** Keep conversion.fromStockQty aligned with the pack row in the local catalog. */
export function withLivePackStock(
  products: CatalogProductRecord[],
): CatalogProductRecord[] {
  const byId = new Map(products.map((row) => [row.productId, row]));
  return products.map((product) => {
    if (!product.unitConversion) return product;
    const pack = byId.get(product.unitConversion.fromProductId);
    if (!pack || pack.stockQty === product.unitConversion.fromStockQty) {
      return product;
    }
    return {
      ...product,
      unitConversion: {
        ...product.unitConversion,
        fromStockQty: pack.stockQty,
      },
    };
  });
}

export async function performUnpack(
  product: CatalogProductRecord,
): Promise<
  | { ok: true; product: CatalogProductRecord; response: UnpackUnitResponse }
  | { ok: false; message: string }
> {
  try {
    const res = await authorizedFetch(
      `/inventory/products/${product.productId}/unpack`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_qty: 1 }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      return {
        ok: false,
        message: body?.message ?? `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as UnpackUnitResponse;
    await patchCatalogStocks([
      { productId: data.from_product_id, stockQty: data.from_stock_qty },
      { productId: data.to_product_id, stockQty: data.to_stock_qty },
    ]);
    const conversion = product.unitConversion
      ? {
          ...product.unitConversion,
          fromStockQty: data.from_stock_qty,
        }
      : null;
    return {
      ok: true,
      response: data,
      product: {
        ...product,
        stockQty: data.to_stock_qty,
        unitConversion: conversion,
      },
    };
  } catch {
    return { ok: false, message: "network" };
  }
}
