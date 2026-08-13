import { ForbiddenException } from "@nestjs/common";
import { LoyaltyService } from "./loyalty.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

describe("LoyaltyService", () => {
  it("cashier cannot update the program", async () => {
    const service = new LoyaltyService();
    await expect(
      service.updateProgram({ enabled: false }, { role: "cashier" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
