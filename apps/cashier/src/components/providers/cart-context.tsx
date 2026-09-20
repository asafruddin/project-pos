"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { CatalogProductRecord } from "@pos-apps/local-db";

export type CartLine = {
  productId: string;
  name: string;
  priceMinor: number;
  catalogPriceMinor: number;
  qty: number;
  stockQty: number;
  trackStock?: boolean;
};

type CartContextValue = {
  lines: CartLine[];
  guestName: string | null;
  add: (product: CatalogProductRecord) => void;
  setQty: (productId: string, qty: number) => void;
  /** Raise the cart line stock cap after unpack (then caller may add/increment). */
  raiseStockCap: (productId: string, stockQty: number) => void;
  clear: () => void;
  replaceLines: (next: CartLine[]) => void;
  pruneToSellable: (sellable: CatalogProductRecord[]) => void;
  setGuestName: (name: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function withCatalogPrice(lines: CartLine[]): CartLine[] {
  return lines.map((line) => {
    const catalogPriceMinor = line.catalogPriceMinor ?? line.priceMinor;
    return {
      ...line,
      catalogPriceMinor,
      priceMinor: catalogPriceMinor,
    };
  });
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [guestName, setGuestNameState] = useState<string | null>(null);
  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      guestName,
      add(product) {
        setLines((current) => {
          const unlimited = product.trackStock === false;
          const line = current.find((entry) => entry.productId === product.productId);
          if (line) {
            return current.map((entry) =>
              entry.productId === product.productId
                ? {
                    ...entry,
                    trackStock: unlimited ? false : entry.trackStock,
                    stockQty: unlimited
                      ? entry.stockQty
                      : Math.max(entry.stockQty, product.stockQty),
                    qty: unlimited
                      ? entry.qty + 1
                      : Math.min(
                          entry.qty + 1,
                          Math.max(entry.stockQty, product.stockQty),
                        ),
                  }
                : entry,
            );
          }
          if (!unlimited && product.stockQty <= 0) return current;
          const catalogPriceMinor = product.priceMinor;
          return [
            ...current,
            {
              productId: product.productId,
              name: product.name,
              catalogPriceMinor,
              priceMinor: catalogPriceMinor,
              qty: 1,
              stockQty: product.stockQty,
              trackStock: unlimited ? false : true,
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
                  ? {
                      ...line,
                      qty:
                        line.trackStock === false
                          ? qty
                          : Math.min(qty, line.stockQty),
                    }
                  : line,
              ),
        );
      },
      raiseStockCap(productId, stockQty) {
        setLines((current) =>
          current.map((line) =>
            line.productId === productId
              ? { ...line, stockQty: Math.max(line.stockQty, stockQty) }
              : line,
          ),
        );
      },
      clear() {
        setLines([]);
        setGuestNameState(null);
      },
      replaceLines(next) {
        setLines(withCatalogPrice(next));
      },
      pruneToSellable(sellable) {
        const ids = new Set(sellable.map((product) => product.productId));
        setLines((current) =>
          current.filter((line) => ids.has(line.productId)),
        );
      },
      setGuestName(next) {
        if (next == null) {
          setGuestNameState(null);
          return;
        }
        setGuestNameState(next.trim() ? next : null);
      },
    }),
    [lines, guestName],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
