import { addProduct, cartFromParked, cartItemCount, cartTotalMinor, emptyCart, pruneToSellable, raiseStockCap, setQty } from "@/features/cart/domain/cart";
import type { CatalogProduct } from "@/features/catalog/domain/product";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { encodeKitchenReceipt, encodeSaleReceipt, queueNumberForDay, type ReceiptLabels } from "@/features/receipt/domain/receipt-encoder";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";
import { formatIdr } from "@/utils/money";

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  productId: "p1", name: "Kopi", priceMinor: 15000, stockQty: 2, status: "active",
  parentId: null, sku: null, categoryName: null, unitName: null, unitConversion: null, trackStock: true, ...over,
});

describe("cart", () => {
  it("adds, totals and removes lines", () => {
    let cart = addProduct(emptyCart, product({}));
    cart = addProduct(cart, product({}));
    expect(cartItemCount(cart)).toBe(2);
    expect(cartTotalMinor(cart)).toBe(30000);
    expect(setQty(cart, "p1", 0).lines).toHaveLength(0);
  });

  it("never exceeds local stock for tracked products, but not for untracked", () => {
    let cart = emptyCart;
    for (let i = 0; i < 5; i += 1) cart = addProduct(cart, product({ stockQty: 2 }));
    expect(cart.lines[0].qty).toBe(2);
    expect(setQty(cart, "p1", 9).lines[0].qty).toBe(2);

    let free = emptyCart;
    for (let i = 0; i < 5; i += 1) free = addProduct(free, product({ trackStock: false, stockQty: 0 }));
    expect(free.lines[0].qty).toBe(5);
  });

  it("does not add a sold-out product", () => {
    expect(addProduct(emptyCart, product({ stockQty: 0 })).lines).toHaveLength(0);
  });
});

describe("money + base64", () => {
  it("formats rupiah with dot grouping", () => {
    expect(formatIdr(0)).toBe("Rp\u00a00");
    expect(formatIdr(1250000)).toBe("Rp\u00a01.250.000");
    expect(formatIdr(-5000)).toBe("-Rp\u00a05.000");
    expect(formatIdr(53000, "en")).toBe("IDR\u00a053,000");
  });

  it("round-trips arbitrary bytes", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
    expect(bytesToBase64(new TextEncoder().encode("hello"))).toBe("aGVsbG8=");
  });
});

describe("receipt encoder", () => {
  const labels: ReceiptLabels = {
    customerCopy: "Customer", kitchenCopy: "Kitchen", walkIn: "Walk-in", voided: "VOID", total: "Total",
    cash: "Cash", qris: "QRIS", storeCredit: "Store credit", thanks: "Thanks from {store}",
    promoDiscount: "Promo", voucher: "Voucher", managerDiscount: "Manager discount",
    queue: "Queue", guest: "Name",
  };
  const sale: CompletedSale = {
    saleId: "abcdef12-0000-4000-8000-000000000000",
    deviceId: "d", createdAt: "2025-01-01T03:00:00.000Z", completedAt: "2025-01-01T03:00:00.000Z",
    lines: [{ productId: "p1", name: "Kopi Susu", qty: 2, priceMinor: 18000 }],
    payment: { method: "cash", amountMinor: 36000, tenders: [{ method: "cash", amountMinor: 36000 }] },
    promotions: null, customerId: null, guestName: "Budi", queueNumber: 7, shiftId: "s", voidedAt: null, voidId: null,
  };

  const decode = (b: Uint8Array) => new TextDecoder().decode(b);

  it("is a valid ESC/POS job: init first, tear feed last", () => {
    const bytes = encodeSaleReceipt(sale, { storeName: "Warung A", labels });
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-3))).toEqual([0x1b, 0x64, 0x06]);
  });

  it("prints discount rows between subtotal and tenders", () => {
    const discounted: CompletedSale = {
      ...sale,
      promotions: {
        discountMinor: 2000, couponCode: "HEMAT", voucherCode: "VCH", voucherMinor: 3000, managerDiscountMinor: 1000,
        applied: [{ promotionId: "p", name: "n", discountMinor: 2000 }],
      },
    };
    const text = decode(encodeSaleReceipt(discounted, { storeName: "Warung A", labels }));
    expect(text).toContain("Promo");
    expect(text).toContain("-Rp 2.000");
    expect(text).toContain("Voucher (VCH)");
    expect(text).toContain("Manager discount");
  });

  it("prints the store, short id, guest, lines and total within 32 columns", () => {
    const text = decode(encodeSaleReceipt(sale, { storeName: "Warung A", labels, queueNumber: 7 }));
    expect(text).toContain("Warung A");
    expect(text).toContain("ABCDEF12");
    expect(text).toContain("Queue");
    expect(text).toContain("#7");
    expect(text).toContain("Name: Budi");
    expect(text).toContain("Kopi Susu");
    expect(text).toContain("2 x Rp 18.000");
    expect(text).toContain("Rp 36.000");
    expect(text).toContain("Thanks from Warung A");
    const lines = text.split("\n").filter((l) => /^[ -~]*$/.test(l));
    expect(lines.every((l) => l.length <= 32)).toBe(true);
  });

  it("prints two kitchen tickets with names, quantities, queue and guest", () => {
    const bytes = encodeKitchenReceipt(sale, { storeName: "Warung A", labels, queueNumber: 7, customerName: "Budi" });
    const text = decode(bytes);
    expect(text.split("Kitchen").length - 1).toBe(2);
    expect(text.split("#7").length - 1).toBe(2);
    expect(text.split("Name: Budi").length - 1).toBe(2);
    expect(text).toContain("Kopi Susu");
    expect(text).toContain("x2");
    expect(text).not.toContain("Rp");
    expect(text).not.toContain("Cash");
    const cut = [0x1d, 0x56, 0x00];
    let cuts = 0;
    for (let i = 0; i <= bytes.length - 3; i += 1) {
      if (bytes[i] === cut[0] && bytes[i + 1] === cut[1] && bytes[i + 2] === cut[2]) cuts += 1;
    }
    expect(cuts).toBe(0);
  });

  it("assigns a stable 1-based queue number for the day", () => {
    expect(queueNumberForDay("b", [
      { saleId: "c", completedAt: "2025-01-01T04:00:00.000Z" },
      { saleId: "a", completedAt: "2025-01-01T03:00:00.000Z" },
      { saleId: "b", completedAt: "2025-01-01T03:00:00.000Z" },
    ])).toBe(2);
    expect(queueNumberForDay("new", [])).toBe(1);
  });
});

describe("cart extras", () => {
  it("raises the stock cap after an unpack and prunes unsellable lines", () => {
    const cart = addProduct(emptyCart, product({ stockQty: 1 }));
    expect(addProduct(cart, product({ stockQty: 1 })).lines[0].qty).toBe(1);
    const raised = raiseStockCap(cart, "p1", 5);
    expect(setQty(raised, "p1", 4).lines[0].qty).toBe(4);
    expect(pruneToSellable(raised, [product({ productId: "other" })]).lines).toHaveLength(0);
  });

  it("rebuilds a held cart repriced from the live catalog", () => {
    const live = new Map([["p1", product({ priceMinor: 20000, stockQty: 3 })]]);
    const cart = cartFromParked([{ productId: "p1", name: "Kopi", priceMinor: 15000, qty: 2 }, { productId: "gone", name: "Old", priceMinor: 1000, qty: 1 }], live);
    expect(cart.lines[0]).toMatchObject({ priceMinor: 20000, qty: 2, maxQty: 3 });
    expect(cart.lines[1]).toMatchObject({ priceMinor: 1000, maxQty: 1 }); // unknown product keeps its snapshot
  });
});
