import { AppError, isAppError } from "@/core/errors/app-error";
import type { CatalogProduct } from "./product";
import type { CatalogRepository, UnpackRemote } from "./ports";

/** Open one pack into pieces on the server (online only), then mirror the new stock locally. */
export class UnpackUseCase {
  constructor(
    private readonly remote: UnpackRemote,
    private readonly catalog: CatalogRepository,
    private readonly online: () => boolean,
  ) {}

  async execute(product: CatalogProduct): Promise<CatalogProduct> {
    if (!this.online()) throw new AppError("NETWORK", "UNPACK_OFFLINE");
    try {
      const res = await this.remote.unpack(product.productId);
      this.catalog.patchStocks([
        { productId: res.fromProductId, stockQty: res.fromStockQty },
        { productId: res.toProductId, stockQty: res.toStockQty },
      ]);
      return {
        ...product,
        stockQty: res.toStockQty,
        unitConversion: product.unitConversion ? { ...product.unitConversion, fromStockQty: res.fromStockQty } : null,
      };
    } catch (error) {
      // Surface the server's message (e.g. "pack out of stock") to the dialog.
      throw isAppError(error) ? error : new AppError("NETWORK", "UNPACK_FAILED");
    }
  }
}
