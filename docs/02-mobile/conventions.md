# Conventions

## Code
- TypeScript strict. Path alias `@/` → `app/`. No relative `../..` chains across layers.
- Files: components `PascalCase.tsx`; everything else `kebab-case.ts`; one use case / repository per file.
- Money is **integer rupiah** (`*Minor` fields). Format with `formatIdr` (hand-rolled; Hermes `Intl` is inconsistent).
- Times: ISO-8601 strings in domain/DB rows; epoch ms for scheduling fields (`nextAttemptAt`, `createdAt` on queues).
- Errors: throw `AppError(code)`; use `isTransientError` / `isAuthError` to decide retry vs. stop.
- IDs are client-generated UUIDs (`IdGenerator`) so retries are idempotent.
- Strings: `i18n/en.ts` + `i18n/id.ts` (`id` is typed against `en`, so a missing key fails typecheck). Default language `id`.
- UI: minimum 44 dp touch targets (`TOUCH_MIN`); every `Pressable` has an accessibility role/label; colours only from `useTheme()` tokens (never hard-coded hex in screens); see [ui-kit.md](./ui-kit.md).
- Lint runs the React Compiler rules: no setState in effect bodies (derive state or set it from async callbacks) and no `ref.current` reads during render (create `Animated.Value`/`PanResponder` in `useState` initialisers).

## Database
- Schema in `app/infrastructure/db/schema/*`; after any change run `pnpm --filter @pos-apps/mobile db:generate` and commit `drizzle/`.
- Multi-table writes go in `db.transaction(...)`; outbox rows are inserted in the **same** transaction as the data.
- Repositories take `AppDb` (driver-agnostic), so tests run the real migrations on in-memory `better-sqlite3`.

## Testing (jest, Node environment)
- Specs in `test/` run in plain Node via `babel-jest` + `babel-preset-expo` (no React Native runtime), so they cover
  framework-free code only. `jest-expo` was dropped: under pnpm it resolves duplicate peer variants of `expo` and
  fails to find `expo-modules-core`. Add it back (and test the dedupe) only if component tests are needed.
- Specs in `test/`. Prefer real SQLite (`test/helpers/test-db.ts`) over mocking repositories.
- Time and ids are injected (`fakeClock`, `sequentialIds`); use jest fake timers for scheduler/monitor.
- Every sync behaviour in [offline-sync.md](./offline-sync.md) has a spec; keep it that way when adding outbox kinds.
- Run before finishing: `lint`, `typecheck`, `test`.

## Dependencies
- Install with `npx expo install <pkg>` from `apps/mobile` so versions match the SDK.
- Prefer Expo modules; add a library only with a clear need. No MobX / Redux / TanStack Query for local data.
- Check docs for the SDK in use (`https://docs.expo.dev/versions/v57.0.0/`) before using an Expo API.
