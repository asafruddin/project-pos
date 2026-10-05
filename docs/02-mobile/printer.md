# Receipt printing

## Why a native app

The PWA prints through Web Bluetooth (BLE only, 20-byte chunks) or falls back to `window.print()` via a third-party
ESC/POS print-service app. Most 58 mm thermal printers speak **classic Bluetooth (SPP/RFCOMM)**, which Web Bluetooth
cannot reach, and a browser tab cannot keep a connection alive in the background.

## What exists now

- `features/receipt/domain/escpos.ts` — ESC/POS builder (copied from `apps/cashier/src/lib/printer/escpos.ts`).
- `features/receipt/domain/receipt-encoder.ts` — customer-copy layout, mirrors `encodeCustomerCopy` in the PWA
  (discounts / loyalty lines arrive with those features).
- `features/receipt/domain/printer.ts` — the **`Printer` port**:
  `getStatus()`, `subscribe()`, `connect()`, `print(bytes)`; states `unconfigured | disconnected | connecting | connected | printing | error`.
- `features/receipt/domain/print-queue.ts` — receipts are **persisted (`print_jobs`) before printing**. Completing a
  sale never waits on or fails because of the printer. The queue drains oldest-first on enqueue and whenever the
  printer status becomes ready; it stops at the first failure to keep order.
- `infrastructure/printer/stub-printer.ts` — fake printer that can be "unplugged" (Settings → Dev button) to exercise
  the queue and the `PrinterBadge` on an emulator.

## Next task: native Bluetooth module (`modules/pos-printer`, Expo local module, Kotlin)

Implements the same `Printer` contract; nothing above the port changes.

1. **Transport:** classic SPP — `device.createRfcommSocketToServiceRecord(00001101-0000-1000-8000-00805F9B34FB)`.
   Printer is paired once in Android settings; the app stores its MAC. BLE GATT stays as an optional fallback for
   BLE-only printers. Write in 512–1024 byte chunks with a small pacing delay (SPP has no per-write ack).
2. **Foreground service** (`foregroundServiceType=connectedDevice`) with a persistent notification owns the socket,
   so Android does not kill it. Permissions: `BLUETOOTH_CONNECT` (Android 12+), `POST_NOTIFICATIONS` (13+),
   `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CONNECTED_DEVICE` (14+). Ask for the battery-optimisation exemption;
   on Xiaomi/Oppo/Vivo guide the user to enable autostart.
3. **Connection manager** with exponential-backoff auto-reconnect; listens to `ACL_CONNECTED` / `ACL_DISCONNECTED`
   and `BluetoothAdapter.ACTION_STATE_CHANGED`; reconnects on app resume; connect-on-demand before each print as a
   safety net; light keepalive (`ESC @` or `DLE EOT 4` status poll — verify which keeps the real printer awake).
4. **Status:** `DLE EOT n` for paper-out / cover-open where the printer supports it.
5. Expose through the Expo Modules API; map native events to `PrinterStatus`; swap `StubPrinter` for the adapter in
   `container.ts`; add the Bluetooth permissions in `app.config.ts`.

Hardware tips: disable the printer's auto power-off, keep it within a couple of metres, remember a printer pairs
with one host at a time, and test on the actual tablet/phone and printer that will be deployed.

**Open question:** the exact printer model (SPP vs BLE, buffer size, status-command support) decides details of 1 and 3.
