import type { CatalogProduct } from "@/features/catalog/domain/product";
import type { ParkedCartLine } from "./parked-cart";

export type CartLine = {
  productId: string;
  name: string;
  priceMinor: number;
  qty: number;
  /** Max sellable qty from local stock; null = untracked (unlimited). */
  maxQty: number | null;
};

export type Cart = { lines: CartLine[] };

export const emptyCart: Cart = { lines: [] };

function maxQtyFor(product: CatalogProduct): number | null {
  return product.trackStock ? Math.max(0, product.stockQty) : null;
}

function clamp(qty: number, maxQty: number | null): number {
  return maxQty === null ? qty : Math.min(qty, maxQty);
}

/** Add one unit; ignores products with no stock left. */
export function addProduct(cart: Cart, product: CatalogProduct): Cart {
  const maxQty = maxQtyFor(product);
  const existing = cart.lines.find((l) => l.productId === product.productId);
  if (existing) {
    // Stock may have grown since the line was added (unpack, catalog pull).
    const cap = existing.maxQty === null || maxQty === null ? null : Math.max(existing.maxQty, maxQty);
    const qty = clamp(existing.qty + 1, cap);
    if (qty === existing.qty && cap === existing.maxQty) return cart;
    return { lines: cart.lines.map((l) => (l === existing ? { ...l, qty, maxQty: cap } : l)) };
  }
  if (maxQty === 0) return cart;
  return {
    lines: [...cart.lines, { productId: product.productId, name: product.name, priceMinor: product.priceMinor, qty: 1, maxQty }],
  };
}

/** Set a line's quantity; 0 (or less) removes it. */
export function setQty(cart: Cart, productId: string, qty: number): Cart {
  if (!Number.isInteger(qty) || qty <= 0) {
    return { lines: cart.lines.filter((l) => l.productId !== productId) };
  }
  return { lines: cart.lines.map((l) => (l.productId === productId ? { ...l, qty: clamp(qty, l.maxQty) } : l)) };
}

/** After an unpack the line may be raised past its old stock cap. */
export function raiseStockCap(cart: Cart, productId: string, stockQty: number): Cart {
  return {
    lines: cart.lines.map((l) =>
      l.productId === productId && l.maxQty !== null ? { ...l, maxQty: Math.max(l.maxQty, stockQty) } : l,
    ),
  };
}

/** Drop lines whose product is no longer sellable (catalog refresh). */
export function pruneToSellable(cart: Cart, sellable: CatalogProduct[]): Cart {
  const ids = new Set(sellable.map((p) => p.productId));
  return { lines: cart.lines.filter((l) => ids.has(l.productId)) };
}

/** Rebuild a cart from a held one, repriced and re-capped from the live catalog. */
export function cartFromParked(lines: ParkedCartLine[], catalog: Map<string, CatalogProduct>): Cart {
  return {
    lines: lines.map((line) => {
      const product = catalog.get(line.productId);
      const tracked = product ? product.trackStock : true;
      return {
        productId: line.productId,
        name: line.name,
        priceMinor: product?.priceMinor ?? line.priceMinor,
        qty: line.qty,
        maxQty: tracked ? Math.max(line.qty, product?.stockQty ?? line.qty) : null,
      };
    }),
  };
}

export function cartTotalMinor(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.priceMinor * l.qty, 0);
}

export function cartItemCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}
