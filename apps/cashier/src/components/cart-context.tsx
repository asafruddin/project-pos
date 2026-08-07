"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { CatalogProductRecord } from "@pos-apps/local-db";

export type CartLine = {
  productId: string;
  name: string;
  priceMinor: number;
  qty: number;
  stockQty: number;
};

type CartContextValue = {
  lines: CartLine[];
  add: (product: CatalogProductRecord) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const value = useMemo<CartContextValue>(
    () => ({
      lines,
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
          return [
            ...current,
            {
              productId: product.productId,
              name: product.name,
              priceMinor: product.priceMinor,
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
      },
    }),
    [lines],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
