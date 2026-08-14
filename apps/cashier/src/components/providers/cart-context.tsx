"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  resolveSellingPrice,
  type CachedCustomerRecord,
  type CatalogProductRecord,
} from "@pos-apps/local-db";

export type CartLine = {
  productId: string;
  name: string;
  priceMinor: number;
  catalogPriceMinor: number;
  qty: number;
  stockQty: number;
};

type CartContextValue = {
  lines: CartLine[];
  customer: CachedCustomerRecord | null;
  add: (product: CatalogProductRecord) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  replaceLines: (next: CartLine[]) => void;
  pruneToSellable: (sellable: CatalogProductRecord[]) => void;
  setCustomer: (customer: CachedCustomerRecord | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function sellingPrice(
  catalogPriceMinor: number,
  productId: string,
  customer: CachedCustomerRecord | null,
): number {
  return resolveSellingPrice({
    catalog_price_minor: catalogPriceMinor,
    customer_price_minor: customer?.customerPrices?.[productId],
    group_price_minor: customer?.groupPrices?.[productId],
  });
}

function reprice(
  lines: CartLine[],
  customer: CachedCustomerRecord | null,
): CartLine[] {
  return lines.map((line) => {
    const catalogPriceMinor = line.catalogPriceMinor ?? line.priceMinor;
    return {
      ...line,
      catalogPriceMinor,
      priceMinor: sellingPrice(catalogPriceMinor, line.productId, customer),
    };
  });
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomerState] = useState<CachedCustomerRecord | null>(
    null,
  );
  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      customer,
      add(product) {
        setLines((current) => {
          const line = current.find((entry) => entry.productId === product.productId);
          if (line) {
            return current.map((entry) =>
              entry.productId === product.productId
                ? { ...entry, qty: Math.min(entry.qty + 1, entry.stockQty) }
                : entry,
            );
          }
          if (product.stockQty <= 0) return current;
          const catalogPriceMinor = product.priceMinor;
          return [
            ...current,
            {
              productId: product.productId,
              name: product.name,
              catalogPriceMinor,
              priceMinor: sellingPrice(
                catalogPriceMinor,
                product.productId,
                customer,
              ),
              qty: 1,
              stockQty: product.stockQty,
            },
          ];
        });
      },
      setQty(productId, qty) {
        setLines((current) =>
          qty <= 0
            ? current.filter((line) => line.productId !== productId)
            : current.map((line) =>
                line.productId === productId
                  ? { ...line, qty: Math.min(qty, line.stockQty) }
                  : line,
              ),
        );
      },
      clear() {
        setLines([]);
        setCustomerState(null);
      },
      replaceLines(next) {
        setLines(reprice(next, customer));
      },
      pruneToSellable(sellable) {
        const ids = new Set(sellable.map((product) => product.productId));
        setLines((current) =>
          current.filter((line) => ids.has(line.productId)),
        );
      },
      setCustomer(next) {
        setCustomerState(next);
        setLines((current) => reprice(current, next));
      },
    }),
    [lines, customer],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
