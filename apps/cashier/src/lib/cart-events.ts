export const CART_TOGGLE_EVENT = "pos-cashier-cart-toggle";

export function toggleCashierCart(): void {
  window.dispatchEvent(new Event(CART_TOGGLE_EVENT));
}
