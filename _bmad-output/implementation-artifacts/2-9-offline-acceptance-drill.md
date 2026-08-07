# Story 2.9: Offline acceptance drill

Status: done

## Manual drill

1. Sign in as `cashier` / `Cashier123!`, unlock the PIN, and pull the catalog.
2. Disable network, add a product, adjust quantity, choose **Bayar**, and confirm the receipt.
3. Reload Cashier: verify the catalog and completed local sale remain available.
4. Restore network and wait for **Menunggu unggah** to clear.
5. Open Dashboard and verify the matching server product stock decreased once.
6. Reload or reconnect again; verify the sale does not decrement stock twice.

## Automated coverage

`packages/domain/src/accept-complete-sale.spec.ts` verifies combined line quantities and fail-closed insufficient/invalid stock handling. API integration requires a configured PostgreSQL database and is covered by the manual drill above.
