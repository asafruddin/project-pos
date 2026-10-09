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
  managerPinHash: null as string | null,
  managerPinSalt: null as string | null,
  managerPinIterations: null as number | null,
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

  it("stores a new manager PIN as PBKDF2 material, never the PIN itself", async () => {
    const set = mockDb({ ...baseRow, managerPinHash: "h", managerPinSalt: "s", managerPinIterations: 100_000 });
    const result = await service.updateStore(STORE, { manager_pin: "123456" });
    const patch = set.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.managerPinIterations).toBe(100_000);
    expect(JSON.stringify(patch)).not.toContain("123456");
    expect(typeof patch.managerPinHash).toBe("string");
    expect(typeof patch.managerPinSalt).toBe("string");
    expect(result.manager_pin_custom).toBe(true);
  });

  it("rejects a manager PIN that is not 6 digits", async () => {
    mockDb(baseRow);
    await expect(service.updateStore(STORE, { manager_pin: "12345" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("goes back to the default manager PIN", async () => {
    const set = mockDb(baseRow);
    const result = await service.updateStore(STORE, { manager_pin_reset: true });
    expect(set).toHaveBeenCalledWith({ managerPinHash: null, managerPinSalt: null, managerPinIterations: null });
    expect(result.manager_pin_custom).toBe(false);
  });
});
