import {
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
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { authorizedFetch } from "@/lib/api-client";

export type FlushResult = {
  pendingCount: number;
  failed: boolean;
  uploaded: boolean;
};

function isAuthErr(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
  );
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

/** Customers → shift opens → cash in/out → shift closes → sales → voids (AD-14 / AD-16). Close does not drain sales. */
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

  for (const item of await listPendingCustomerCreates()) {
    try {
      const response = await authorizedFetch("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCreateCustomerRequest(item)),
      });
      if (response.ok) await markCustomerCreateSynced(item.customerId);
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) {
        return { pendingCount: await pendingTotal(), failed: true, uploaded: false };
      }
      failed = true;
    }
  }

  for (const shift of await listPendingShiftOpens()) {
    try {
      const response = await authorizedFetch("/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSyncShiftRequest(shift)),
      });
      if (response.ok) await markShiftSynced(shift.shiftId);
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) {
        return { pendingCount: await pendingTotal(), failed: true, uploaded: false };
      }
      failed = true;
    }
  }

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
      if (response.ok) await markCashMovementSynced(movement.movementId);
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) {
        return { pendingCount: await pendingTotal(), failed: true, uploaded: false };
      }
      failed = true;
    }
  }

  for (const shift of await listPendingShiftCloses()) {
    try {
      const response = await authorizedFetch(`/shifts/${shift.shiftId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCloseShiftRequest(shift)),
      });
      if (response.ok) await markShiftCloseSynced(shift.shiftId);
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) {
        return { pendingCount: await pendingTotal(), failed: true, uploaded: false };
      }
      failed = true;
    }
  }

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
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) {
        return { pendingCount: await pendingTotal(), failed: true, uploaded: false };
      }
      failed = true;
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
      else failed = true;
    } catch (err) {
      if (isAuthErr(err)) break;
      failed = true;
    }
  }

  const remaining = await pendingTotal();
  return {
    pendingCount: remaining,
    failed: failed && remaining > 0,
    uploaded: queued > 0 && remaining < queued,
  };
}
