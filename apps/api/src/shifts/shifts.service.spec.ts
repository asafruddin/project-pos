import { BadRequestException } from "@nestjs/common";
import { openShift } from "@pos-apps/domain";
import { ShiftsService } from "./shifts.service";

jest.mock("@pos-apps/domain", () => {
  const actual = jest.requireActual("@pos-apps/domain");
  return {
    ...actual,
    openShift: jest.fn(actual.openShift),
  };
});

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const openShiftMock = openShift as jest.MockedFunction<typeof openShift>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const shiftId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("ShiftsService", () => {
  let service: ShiftsService;

  beforeEach(() => {
    service = new ShiftsService();
    jest.clearAllMocks();
  });

  it("open is idempotent on shift_id", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                shiftId,
                storeId: "s",
                registerId: "r",
                openedAt: new Date("2026-08-13T00:00:00Z"),
                openingCashMinor: 100000,
                status: "open",
                closedAt: null,
                actorId: null,
                createdAt: new Date("2026-08-13T00:00:00Z"),
              },
            ],
          }),
        }),
      }),
    } as never);

    const result = await service.open({
      shift_id: shiftId,
      opened_at: "2026-08-13T00:00:00.000Z",
      opening_cash_minor: 100000,
    });
    expect(result.already_accepted).toBe(true);
    expect(openShiftMock).not.toHaveBeenCalled();
  });

  it("rejects a second open on the register", async () => {
    openShiftMock.mockReturnValue({
      ok: false,
      code: "SHIFT_ALREADY_OPEN",
      message: "Shift masih terbuka. Tutup dulu sebelum buka yang baru.",
    });
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);

    await expect(
      service.open({
        shift_id: shiftId,
        opened_at: "2026-08-13T00:00:00.000Z",
        opening_cash_minor: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("recordCash is idempotent on movement_id", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                movementId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                shiftId,
                kind: "in",
                amountMinor: 1000,
                reason: "isi",
                occurredAt: new Date("2026-08-13T01:00:00Z"),
                actorId: null,
                createdAt: new Date("2026-08-13T01:00:00Z"),
              },
            ],
          }),
        }),
      }),
    } as never);
    const first = await service.recordCash(shiftId, {
      movement_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      kind: "in",
      amount_minor: 1000,
      reason: "isi",
      occurred_at: "2026-08-13T01:00:00.000Z",
    });
    expect(first.already_accepted).toBe(true);
  });

  it("recordCash rejects a closed shift", async () => {
    let calls = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              calls += 1;
              if (calls === 1) return [];
              return [
                {
                  shiftId,
                  storeId: "s",
                  registerId: "r",
                  openedAt: new Date("2026-08-13T00:00:00Z"),
                  openingCashMinor: 0,
                  status: "closed",
                  closedAt: new Date("2026-08-13T00:30:00Z"),
                  countedCashMinor: 0,
                  expectedCashMinor: 0,
                  differenceMinor: 0,
                  actorId: null,
                  createdAt: new Date("2026-08-13T00:00:00Z"),
                },
              ];
            },
          }),
        }),
      }),
    } as never);
    await expect(
      service.recordCash(shiftId, {
        movement_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        kind: "out",
        amount_minor: 1000,
        reason: "tip",
        occurred_at: "2026-08-13T01:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("replays cash in/out on a closed shift when occurred_at is before close", async () => {
    let calls = 0;
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              calls += 1;
              if (calls === 1) return [];
              return [
                {
                  shiftId,
                  storeId: "s",
                  registerId: "r",
                  openedAt: new Date("2026-08-13T00:00:00Z"),
                  openingCashMinor: 0,
                  status: "closed",
                  closedAt: new Date("2026-08-13T02:00:00Z"),
                  countedCashMinor: 0,
                  expectedCashMinor: 0,
                  differenceMinor: 0,
                  actorId: null,
                  createdAt: new Date("2026-08-13T00:00:00Z"),
                },
              ];
            },
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              movementId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              shiftId,
              kind: "out",
              amountMinor: 1000,
              reason: "tip",
              occurredAt: new Date("2026-08-13T01:00:00Z"),
              actorId: null,
              createdAt: new Date("2026-08-13T01:00:00Z"),
            },
          ],
        }),
      }),
    } as never);
    const result = await service.recordCash(shiftId, {
      movement_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      kind: "out",
      amount_minor: 1000,
      reason: "tip",
      occurred_at: "2026-08-13T01:00:00.000Z",
    });
    expect(result.already_accepted).toBe(false);
    expect(result.movement.kind).toBe("out");
  });

  it("close is idempotent and does not force a zero difference", async () => {
    const closed = {
      shiftId,
      storeId: "s",
      registerId: "r",
      openedAt: new Date("2026-08-13T00:00:00Z"),
      openingCashMinor: 100000,
      status: "closed" as const,
      closedAt: new Date("2026-08-13T08:00:00Z"),
      countedCashMinor: 90000,
      expectedCashMinor: 100000,
      differenceMinor: -10000,
      actorId: null,
      createdAt: new Date("2026-08-13T00:00:00Z"),
    };
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [closed],
          }),
        }),
      }),
    } as never);
    const result = await service.close(shiftId, {
      closed_at: "2026-08-13T08:00:00.000Z",
      counted_cash_minor: 90000,
      expected_cash_minor: 100000,
    });
    expect(result.already_accepted).toBe(true);
    expect(result.shift.difference_minor).toBe(-10000);
  });
});
