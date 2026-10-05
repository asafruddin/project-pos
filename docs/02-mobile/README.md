# Mobile cashier (Android)

Native Android cashier built with **Expo SDK 57 / React Native 0.86 / React 19**, living in `apps/mobile`
(`@pos-apps/mobile`). It ports the whole cashier PWA (`apps/cashier`) — same flow, same look — and exists mainly so a
native service, not a browser tab, can own the Bluetooth printer connection (see [printer.md](./printer.md)).
It works fully offline like the PWA.

Scope: Android only, one device, one printer. Phone **and** tablet layouts.

## What is implemented

| Area | Status |
|---|---|
| Expo app in the pnpm/turbo monorepo, shares `@pos-apps/domain` + `@pos-apps/types` | done |
| SQLite (expo-sqlite + Drizzle, WAL), migrations `0000`–`0001` | done |
| Connectivity (device network **and** API reachability), outbox sync engine + scheduler | done |
| Account login → 6-digit PIN (enrol/unlock offline, lockout) → forced open shift | done |
| Menu: search, filter sheet, grid/list, pages, cached product photos, unpack | done |
| Cart: promo, coupon, voucher (online), manager discount + PIN, hold/resume, cash presets/change, QRIS | done |
| Receipt preview dialog, print queue (stub printer) | done |
| Shift: cash in/out, count + close (difference warning), intents `logout` / `close-then-open` | done |
| Day close: summary + gate + unsynced acknowledgement → end account session | done |
| Transactions: today's sales, receipt, same-day void (manager PIN / unattended), return (online) | done |
| Customers: search, add (offline-safe), history | done |
| Settings: theme (system/light/dark), language (id/en), sync status/retry, printer status | done |
| Store logo (cached for offline) + orange coffee mark, app icon, splash | done |
| Real Bluetooth printer module (Kotlin SPP + foreground service) | **next** |
| Loyalty redeem, split tender, customer attach at checkout | not ported (not exposed in the PWA UI either) |

## Setup

Requirements: Node 22+ (repo uses 24), pnpm 11, JDK 17–21, Android SDK (`ANDROID_HOME`), an emulator or a
device with USB debugging.

```bash
pnpm install
pnpm --filter @pos-apps/mobile android        # first run: prebuild + gradle build + install (several minutes)
pnpm dev:mobile                               # afterwards: Metro only
```

API URL: the app talks to the deployed API `https://project-pos-api.vercel.app` by default (HTTPS, works on emulator,
real device and release builds). To use a local API, copy `apps/mobile/.env.example` to `.env.local` and set
`EXPO_PUBLIC_API_URL` (`http://10.0.2.2:3001` from the emulator, `http://<LAN-IP>:3001` from a real device), then restart
Metro with `--clear`. Android release builds block cleartext HTTP, so `http://` is for development only.

**Expo Go does not work** — the app needs custom native code (printer module), so use a development build.

## Commands

```bash
pnpm --filter @pos-apps/mobile test        # jest (Node env, real SQLite, fake API/network)
pnpm --filter @pos-apps/mobile lint
pnpm --filter @pos-apps/mobile typecheck
pnpm --filter @pos-apps/mobile db:generate # after editing app/infrastructure/db/schema
node apps/mobile/scripts/generate-icons.mjs # regenerate launcher icon + splash from the brand mark
```

Root `pnpm dev` does **not** start the mobile app on purpose (Metro would join every `pnpm dev`); use `pnpm dev:mobile`.

## Verification status

Automated (run in CI-style, no device): types, lint, 96 jest specs — domain rules, SQLite repositories with the real
migrations, outbox/sync/backoff, connectivity, PIN + lockout (incl. a PBKDF2 reference vector), the whole container
(login → PIN → shift → sell → offline queue → token death → end of day) against a fake API, and the Android bundle +
`gradlew assembleDebug`.

**Not verified by automation: how it looks and feels on a screen.** There is no component/E2E test layer, and the
only local AVD does not start on this machine. Run the checklist below on a phone and a tablet before relying on it.

## Manual device checklist

Run each on **phone portrait**, **tablet landscape**, in **light and dark**, in **Indonesian and English**, and compare
side by side with the PWA (`pnpm dev:cashier`) for look and wording.

1. **Login** wrong password → server message shown; correct → PIN screen (store name + logo).
2. **PIN** first time: choose a 6-digit PIN; wrong PIN ×5 → 30 s lock with countdown; relaunch → PIN asked again.
3. **Open shift** dialog blocks the menu until you enter opening cash (presets 20k/50k/100k).
4. **Sell**: search, filter sheet, grid/list, add items, hold a cart and resume it, pay cash (presets, change, short
   warning) and QRIS, receipt dialog → Print (queued with the stub printer).
5. **Discounts**: coupon, voucher (online), manager discount asks for a manager PIN.
6. **Offline**: airplane mode → banner turns amber, sell 3 → relaunch → data still there → back online → "waiting to
   sync" drains by itself.
7. **Void** a sale (manager PIN first time, then unlock) and **return** (online only; offline shows the notice).
8. **Customers**: add offline, it appears and syncs; open history online and offline.
9. **Shift**: cash in/out, close with a counted difference → warning dialog; **Day close** with unsynced sales →
   acknowledgement; confirm → login screen. Log in again → PIN unlock (no re-enrol) → previous shift/queue intact.
10. **Token death** (let the JWT expire or revoke it): amber/red banner, selling continues, "Sign in" renews it without
    asking for the PIN or closing the shift.

## Related docs

[architecture.md](./architecture.md) · [flows.md](./flows.md) · [offline-sync.md](./offline-sync.md) ·
[ui-kit.md](./ui-kit.md) · [printer.md](./printer.md) · [conventions.md](./conventions.md)
