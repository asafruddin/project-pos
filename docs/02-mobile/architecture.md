# Mobile architecture

Ignite-style `app/` folder conventions (components, theme, i18n, config, navigators, screens, utils) with React
Navigation, organised into clean-architecture layers. Ignite's starter *packages* (MobX-State-Tree, apisauce,
Reactotron, CLI) are intentionally not used.

## Layers and dependency rule

```
presentation  (screens, components, zustand stores)
      │ calls
      ▼
domain  ◄──────────── implements ───────────  data / infrastructure
(entities, use cases,                         (drizzle repositories, fetch client,
 ports = interfaces)                           NetInfo, secure-store, printer adapters)
```

- `domain/` is plain TypeScript. **No** React Native, `expo-*`, drizzle or `fetch` imports. It declares the
  interfaces it needs (`CatalogRepository`, `SalesRepository`, `Printer`, `AuthGateway`, `Clock`, …).
- `data/` (per feature) and `infrastructure/` (cross-cutting) implement those interfaces.
- `presentation/` and `screens/` call use cases and read stores; no business rules, no SQL.
- Everything is wired in exactly one place: `app/core/di/container.ts` (`createContainer(deps)`). Tests build the
  same container with fakes (in-memory SQLite, fake network).

Shared business logic is **not** duplicated: pricing, split-tender and discount stacking come from
`@pos-apps/domain`; API DTOs from `@pos-apps/types`. `@pos-apps/local-db` (IndexedDB) and `@pos-apps/ui` (DOM) are
web-only and not used.

## Tree

```
apps/mobile/
  app.config.ts  metro.config.js  babel.config.js  drizzle.config.ts  jest.config.js
  drizzle/                       # generated SQL migrations (commit them)
  app/
    app.tsx                      # boot: open db → migrate → container.start() → providers
    config/                      # API URL, sync/probe intervals
    core/
      di/                        # container.ts (composition root), container-context.tsx
      errors/                    # AppError, isTransientError / isAuthError
      ports/                     # http, connectivity, clock, id
    features/<feature>/
      domain/                    # entities, ports, use cases (pure)
      data/                      # adapters for that feature
      presentation/              # stores/hooks (cart)
      features: auth, catalog, cart, checkout, receipt, shift, settings
    infrastructure/
      db/                        # schema/, client.ts, migrate.ts, kv-store.ts
      http/                      # fetch client, JWT expiry check
      connectivity/              # monitor (state machine) + NetInfo adapter
      sync/                      # outbox, engine, scheduler, backoff, status store
      printer/                   # StubPrinter (+ native adapter later)
    navigators/  screens/  components/  theme/  i18n/  utils/  devtools/
  test/                          # jest specs + helpers/test-db.ts
```

## State

- **SQLite is the source of truth** for business data.
- **Zustand vanilla stores live in the container** (`auth` gate state, `cart` + pay-step draft, `cartUi`, `prefs`,
  `syncStatus`, `catalogEvents`, `customersEvents`, and `events` — version counters bumped after local writes so screens
  re-read SQLite via `useEventValue`). No global singletons.
- Sync SQLite API: drizzle's expo driver is synchronous. Queries here are small and indexed, so this is fine on the
  JS thread; transactions are short (one sale = one transaction). Keep it that way; do big work in chunks.

## Auth

See [flows.md](./flows.md). `POST /auth/login` (online only). The JWT lives in Android Keystore-backed
`expo-secure-store`, as do the PIN hashes; the non-secret profile (store, role, register, "shift authorised" flag) in
the SQLite `kv` table. An **expired token never blocks selling**: sales keep queueing and sync pauses with a banner
(`auth_required`); signing in again keeps the cart, the queue and the open shift.

## Adding a feature (checklist)

1. Entities + port + use case in `features/<x>/domain` (with a unit test).
2. Drizzle table in `infrastructure/db/schema`, `db:generate`, repository in `features/<x>/data`.
3. If it must reach the server: enqueue an outbox row **in the same transaction**, add a handler (see
   [offline-sync.md](./offline-sync.md)).
4. Wire in `container.ts`; screen under `screens/`; strings in `i18n/en.ts` + `id.ts`.
