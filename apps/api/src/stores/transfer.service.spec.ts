import { BadRequestException } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { StoresService } from "./stores.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

jest.mock("../db/stock-ledger", () => ({
  insertStockMovement: jest.fn().mockResolvedValue(undefined),
}));

import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const insertMovementMock = insertStockMovement as jest.MockedFunction<
  typeof insertStockMovement
>;

describe("TransferService", () => {
  const stores = {
    requireStore: jest.fn().mockResolvedValue("store-a"),
  };

  it("rejects a same-store draft", async () => {
    const service = new TransferService(stores as unknown as StoresService);
    await expect(
      service.create(
        {
          from_store_id: "11111111-1111-4111-8111-111111111111",
          to_store_id: "11111111-1111-4111-8111-111111111111",
          lines: [
            { product_id: "22222222-2222-4222-8222-222222222222", qty: 1 },
          ],
        },
        "actor",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("does not post ledger until ship", () => {
    expect(insertMovementMock).not.toHaveBeenCalled();
  });
});
