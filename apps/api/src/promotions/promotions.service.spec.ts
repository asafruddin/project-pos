import { ForbiddenException } from "@nestjs/common";
import { PromotionsService } from "./promotions.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("PromotionsService", () => {
  it("cashier cannot upsert promotions", async () => {
    const service = new PromotionsService();
    await expect(
      service.upsert(
        { name: "Diskon", kind: "percent", percent_bps: 1000 },
        { role: "cashier" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
