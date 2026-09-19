import {
  adoptServerOpenShift,
  getOpenShift,
  listPendingCashMovements,
  listPendingCustomerCreates,
  listPendingShiftCloses,
  listPendingShiftOpens,
  listPendingSyncSales,
  listPendingSyncVoids,
  markCashMovementSynced,
  markCustomerCreateSynced,
  markSaleSynced,
  markShiftCloseSynced,
  markShiftSynced,
  markVoidSynced,
  stampSaleShiftIfMissing,
  toCloseShiftRequest,
  toCreateCustomerRequest,
  toSyncCashMovementRequest,
  toSyncSaleRequest,
  toSyncShiftRequest,
  toSyncVoidRequest,
} from "@pos-apps/local-db";
import type { CurrentShiftResponse } from "@pos-apps/types";
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { authorizedFetch } from "@/lib/api-client";

export type FlushResult = {
  pendingCount: number;
  failed: boolean;
  uploaded: boolean;
  errorMessage?: string | null;
};

function isAuthErr(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
  );
}

async function readApiError(
  response: Response,
): Promise<{ code?: string; message?: string }> {
  try {
    const body = (await response.json()) as {
      code?: unknown;
      message?: unknown;
    };
    return {
      code: typeof body.code === "string" ? body.code : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch {
    return { message: `HTTP ${response.status}` };
  }
}

async function pendingTotal(): Promise<number> {
  const [customers, shifts, cash, closes, sales, voids] = await Promise.all([
    listPendingCustomerCreates(),
    listPendingShiftOpens(),
    listPendingCashMovements(),
    listPendingShiftCloses(),
    listPendingSyncSales(),
    listPendingSyncVoids(),
  ]);
  return (
    customers.length +
    shifts.length +
    cash.length +
    closes.length +
    sales.length +
    voids.length
  );
}

async function flushCashMovements(
  noteFailure: (message?: string) => void,
  opts?: { ignoreNotFound?: boolean },
): Promise<"auth" | void> {
  for (const movement of await listPendingCashMovements()) {
    try {
      const response = await authorizedFetch(
        `/shifts/${movement.shiftId}/cash`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSyncCashMovementRequest(movement)),
        },
      );
      if (response.ok) {
        await markCashMovementSynced(movement.movementId);
        continue;
      }
      const err = await readApiError(response);
      if (opts?.ignoreNotFound && err.code === "SHIFT_NOT_FOUND") continue;
      noteFailure(err.message);
    } catch (err) {
      if (isAuthErr(err)) return "auth";
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }
}

/**
 * Customers → cash (open shift) → closes → opens → cash (new shift) → sales → voids.
 * Close runs before open so a day-turn does not sit on SHIFT_ALREADY_OPEN.
 * Close does not drain sales.
 */
export async function flushSalesAndVoids(): Promise<FlushResult> {
  const queued = await pendingTotal();
  if (!navigator.onLine) {
    return { pendingCount: queued, failed: false, uploaded: false };
  }
  const token = getAccessToken();
  if (!token || isAccessTokenExpired(token)) {
    return { pendingCount: queued, failed: false, uploaded: false };
  }

  let failed = false;
  let errorMessage: string | null = null;
  const noteFailure = (message?: string) => {
    failed = true;
    if (message && !errorMessage) errorMessage = message;
  };
  const authFail = async (): Promise<FlushResult> => ({
    pendingCount: await pendingTotal(),
    failed: true,
    uploaded: false,
    errorMessage: errorMessage,
  });

  for (const item of await listPendingCustomerCreates()) {
    try {
      const response = await authorizedFetch("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCreateCustomerRequest(item)),
      });
      if (response.ok) await markCustomerCreateSynced(item.customerId);
      else noteFailure((await readApiError(response)).message);
    } catch (err) {
      if (isAuthErr(err)) return authFail();
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }

  if (
    (await flushCashMovements(noteFailure, { ignoreNotFound: true })) === "auth"
  ) {
    return authFail();
  }

  for (const shift of await listPendingShiftCloses()) {
    try {
      const response = await authorizedFetch(`/shifts/${shift.shiftId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCloseShiftRequest(shift)),
      });
      if (response.ok) await markShiftCloseSynced(shift.shiftId);
      else noteFailure((await readApiError(response)).message);
    } catch (err) {
      if (isAuthErr(err)) return authFail();
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }

  for (const shift of await listPendingShiftOpens()) {
    try {
      const response = await authorizedFetch("/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSyncShiftRequest(shift)),
      });
      if (response.ok) {
        await markShiftSynced(shift.shiftId);
        continue;
      }
      const err = await readApiError(response);
      if (err.code === "SHIFT_ALREADY_OPEN") {
        const currentRes = await authorizedFetch("/shifts/current");
        if (!currentRes.ok) {
          noteFailure(err.message);
          continue;
        }
        const current = (await currentRes.json()) as CurrentShiftResponse;
        if (!current.shift) {
          noteFailure(err.message);
          continue;
        }
        await adoptServerOpenShift(shift.shiftId, {
          shiftId: current.shift.shift_id,
          storeId: current.shift.store_id,
          registerId: current.shift.register_id,
          openedAt: current.shift.opened_at,
          openingCashMinor: current.shift.opening_cash_minor,
        });
        continue;
      }
      noteFailure(err.message);
    } catch (err) {
      if (isAuthErr(err)) return authFail();
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }

  if ((await flushCashMovements(noteFailure)) === "auth") return authFail();

  for (const sale of await listPendingSyncSales()) {
    try {
      let toSend = sale;
      if (!sale.shiftId) {
        const open = await getOpenShift();
        if (open) {
          await stampSaleShiftIfMissing(sale.saleId, open.shiftId);
          toSend = { ...sale, shiftId: open.shiftId };
        }
      }
      const response = await authorizedFetch("/sales/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSyncSaleRequest(toSend)),
      });
      if (response.ok) await markSaleSynced(sale.saleId);
      else noteFailure((await readApiError(response)).message);
    } catch (err) {
      if (isAuthErr(err)) return authFail();
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }

  for (const item of await listPendingSyncVoids()) {
    if (!item.sale.voidedAt) continue;
    try {
      const response = await authorizedFetch("/sales/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          toSyncVoidRequest({
            voidId: item.voidId,
            saleId: item.saleId,
            voidedAt: item.sale.voidedAt,
          }),
        ),
      });
      if (response.ok) await markVoidSynced(item.voidId);
      else noteFailure((await readApiError(response)).message);
    } catch (err) {
      if (isAuthErr(err)) break;
      noteFailure(err instanceof Error ? err.message : undefined);
    }
  }

  const remaining = await pendingTotal();
  return {
    pendingCount: remaining,
    failed: failed && remaining > 0,
    uploaded: queued > 0 && remaining < queued,
    errorMessage: failed && remaining > 0 ? errorMessage : null,
  };
}
