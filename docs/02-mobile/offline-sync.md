# Offline mode and sync

Principle: **the UI never waits on the network.** Every action writes to SQLite first. Anything the server must
learn goes through a durable **outbox** that is drained in the background.

## Write path (example: complete a sale)

`CompleteSaleUseCase` → `SalesRepository.recordCompletedSale` runs **one SQLite transaction** that
1. inserts the sale and its lines,
2. decrements local stock for tracked products (optimistic; the next catalog pull after the queue drains is authoritative),
3. inserts a `sale.sync` outbox row (payload = `SyncSaleRequest`, same contract as the PWA).

Then it calls `scheduler.notifyLocalWrite()` (debounced 500 ms). A crash can never leave a sale without its outbox
row, or the reverse. Replaying the same `saleId` is a no-op.

## Outbox (`outbox` table)

| column | meaning |
|---|---|
| `seq` | strict creation order |
| `id`, `kind`, `entityId`, `payload` | row id, kind (below), aggregate id, JSON body |
| `status` | `pending` → `in_flight` → (deleted on success) \| `dead` |
| `attempts`, `nextAttemptAt`, `lastError` | retry bookkeeping (epoch ms) |

Rows are processed **strictly in `seq` order** (a sale must not be sent before the shift it belongs to).

### Kinds (sent in creation order)

`customer.create` · `shift.open` · `cash.movement` · `shift.close` · `sale.sync` · `sale.void`. A shift's open always
precedes its sales/cash/close, and a sale precedes its void, simply because rows go out in `seq` order. If the server
already has an open shift (`SHIFT_ALREADY_OPEN`) the local shift is replaced by the server's and every queued payload
that carries the shift id is rewritten (`adoptServerShift`).

## What needs the network

| Works offline (queued) | Online only (shows the PWA's "needs connection" message) |
|---|---|
| sell, hold/resume, void, open/close shift, cash in/out, add customer, PIN unlock, day close | login, **first** PIN enrolment, voucher lookup, returns, unpack, customer history from the server, server cash refunds in expected cash, catalog/promotions/customers refresh |

## Failure policy (`SyncEngine`)

| Failure | Action |
|---|---|
| network error, timeout, HTTP 5xx / 408 / 429 | stop the run, back off, retry later — **never skip ahead**. Backoff ≈ 1s, 2s, 4s … cap 5 min, ±20% jitter |
| 401 / expired JWT | release the row **without** counting an attempt, phase `auth_required`; scheduler stops retrying until login |
| other 4xx (API rejected it) | mark row `dead` (visible in the UI as "Needs attention"), continue with the next row. Settings → "Retry failed items" revives them |
| unknown row kind | `dead` (never loops) |
| app killed mid-request | `in_flight` rows are reset to `pending` on the next run |

Idempotency: the API accepts `/sales/sync` and `/shifts` by client-generated id, and returns
`already_accepted` for replays, so a retry after a lost response is safe. `SHIFT_ALREADY_OPEN` is handled by
adopting the server's shift and re-pointing local sales and queued payloads (`adoptServerShift`).

`flush()` is single-flight; a request that arrives mid-run triggers one more pass, so a row queued as the loop
finishes is not left waiting for the next tick.

## Connectivity (`ConnectivityMonitor`)

`online` = device network up **and** `GET /health` answered within 4 s. `degraded` = network up but API unreachable
(captive portal, dead uplink, server down) — treated like offline for sync, re-probed every 5 s. `offline` = no
network. While `online` it re-probes every 30 s so a silently dropped uplink is noticed. NetInfo alone is not
trusted because it reports "connected" on dead networks.

## When sync runs (`SyncScheduler`)

app start · transition to `online` · app returns to foreground · after a local write (debounced) · backoff expiry ·
every 30 s while online (safety net) · after login · manual "Sync now".
Order of a cycle: **push the outbox first, then pull** (catalog), so a pull never overwrites state the server has not
seen yet. Pulls run on every trigger except the interval tick, which respects `minIntervalMs` (10 min for the catalog).

## What the UI shows

- `ConnectivityBanner`: amber when offline/degraded; red "Sign in again" when `auth_required`.
- `SyncBadge`: pending count / failed count / all synced.
- Settings: pending, failed, last sync time, last error, "Sync now", "Retry failed items".
- Sign-out is refused while rows are unsynced unless the user confirms.

## Not yet covered

Void, returns, cash in/out, shift close, customer create (add new outbox kinds + handlers); background sync when the
app is closed (WorkManager); conflict handling beyond "server wins on catalog pull".
