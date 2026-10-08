import { BadRequestException } from "@nestjs/common";
import { StoresService } from "./stores.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const STORE = "00000000-0000-4000-8000-000000000001";
const baseRow = {
  storeId: STORE,
  name: "Toko",
  logoPublicId: null,
  logoSecureUrl: null,
  queueResetMode: "daily" as const,
  queueResetAt: null as Date | null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

function mockDb(updated: typeof baseRow) {
  const set = jest.fn().mockReturnValue({ where: () => ({ returning: async () => [updated] }) });
  getDbMock.mockReturnValue({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [baseRow] }) }) }),
    update: () => ({ set }),
  } as never);
  return set;
}

describe("StoresService queue settings", () => {
  const service = new StoresService({} as never);

  afterEach(() => jest.resetAllMocks());

  it("changes the reset mode without requiring a name", async () => {
    const set = mockDb({ ...baseRow, queueResetMode: "shift" });
    const result = await service.updateStore(STORE, { queue_reset_mode: "shift" });
    expect(set).toHaveBeenCalledWith({ queueResetMode: "shift" });
    expect(result.queue_reset_mode).toBe("shift");
    expect(result.queue_reset_at).toBeNull();
  });

  it("reset now stamps queue_reset_at", async () => {
    const stamp = new Date("2026-10-08T10:00:00Z");
    const set = mockDb({ ...baseRow, queueResetAt: stamp });
    const result = await service.updateStore(STORE, { queue_reset_now: true });
    expect(set).toHaveBeenCalledWith({ queueResetAt: expect.any(Date) });
    expect(result.queue_reset_at).toBe(stamp.toISOString());
  });

  it("rejects an empty update", async () => {
    mockDb(baseRow);
    await expect(service.updateStore(STORE, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
