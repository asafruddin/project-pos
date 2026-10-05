import { createStore, type StoreApi } from "zustand/vanilla";
import type { CatalogProduct } from "@/features/catalog/domain/product";
import {
  addProduct,
  pruneToSellable,
  raiseStockCap,
  setQty,
  type Cart,
  type CartLine,
} from "../domain/cart";

export type PayMethod = "cash" | "qris";

/** The in-progress sale: lines + the pay-step inputs, kept across layout changes (phone ⇄ tablet). */
export type CartState = Cart & {
  guestName: string;
  /** Pay step open (PWA: `sale` exists). */
  paying: boolean;
  payMethod: PayMethod;
  cashReceived: string;
  couponCode: string;
  voucherCode: string;
  managerDiscount: string;
  managerPin: string;
  add(product: CatalogProduct): void;
  setQty(productId: string, qty: number): void;
  raiseStockCap(productId: string, stockQty: number): void;
  pruneToSellable(sellable: CatalogProduct[]): void;
  replaceLines(lines: CartLine[], guestName?: string): void;
  set(patch: Partial<Pick<CartState, "guestName" | "paying" | "payMethod" | "cashReceived" | "couponCode" | "voucherCode" | "managerDiscount" | "managerPin">>): void;
  /** Clear the whole sale (after completing, or discarding). */
  clear(): void;
  /** Leave the pay step but keep the lines. */
  cancelPay(): void;
};

export type CartStore = StoreApi<CartState>;

const draft = { paying: false, payMethod: "cash" as PayMethod, cashReceived: "", couponCode: "", voucherCode: "", managerDiscount: "", managerPin: "" };

export function createCartStore(): CartStore {
  return createStore<CartState>((set) => ({
    lines: [],
    guestName: "",
    ...draft,
    add: (product) => set((s) => addProduct({ lines: s.lines }, product)),
    setQty: (productId, qty) => set((s) => setQty({ lines: s.lines }, productId, qty)),
    raiseStockCap: (productId, stockQty) => set((s) => raiseStockCap({ lines: s.lines }, productId, stockQty)),
    pruneToSellable: (sellable) => set((s) => pruneToSellable({ lines: s.lines }, sellable)),
    replaceLines: (lines, guestName = "") => set({ lines, guestName }),
    set: (patch) => set(patch),
    clear: () => set({ lines: [], guestName: "", ...draft }),
    cancelPay: () => set({ ...draft }),
  }));
}
