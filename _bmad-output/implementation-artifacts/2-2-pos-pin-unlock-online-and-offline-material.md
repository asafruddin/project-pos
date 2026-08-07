---
baseline_commit: 4cfa8a96e50fd00deed3cd22ce4c9fad787d9575
---

# Story 2.2: POS PIN unlock (online and offline material)

Status: done

## Story

As a cashier,
I want to enter a 6-digit POS PIN after Account Login, including offline when material exists,
so that the Cashier Menu unlocks only for an authorized device session.

## Acceptance Criteria

1. Correct 6-digit PIN unlocks Cashier Menu (placeholder Menu OK until 2.3) ✓
2. Wrong PIN → “PIN salah. Coba lagi.”; Menu/Cart/Checkout blocked ✓
3. After online Account Login + successful PIN, PIN material stored in Local Database (AD-6) ✓
4. Offline + material present → correct PIN unlocks without live Account Login (FR5) ✓
5. Offline + no material → clear fail ✓
6. PIN never logged plaintext (NFR5) — PBKDF2 hash + salt in IndexedDB ✓
7. Pad keys ≥56px; paste-capable masked numeric input (UX-DR4, UX-DR6) ✓

## Tasks / Subtasks

- [x] Task 1: `packages/local-db` PIN store via `idb`
- [x] Task 2: Cashier PIN UI `/pin`
- [x] Task 3: Gates (`/menu`, home routing)
- [x] Task 4: Docs + hash unit tests

## Dev Notes

**Enrollment model (Phase 1):** After Account Login, first successful 6-digit PIN on this device **enrolls** (stores PBKDF2 hash). Later unlocks verify hash. Not a server-side PIN.

**Unlock session:** `sessionStorage` `pos_cashier_pin_unlocked`.

## Senior Developer Review (AI)

**Outcome:** Approve (with fixes applied)
**Date:** 2026-08-07

### Findings resolved
- [x] Removed unused `useEffect` import from `pin-pad.tsx`
- [x] Removed obsolete `describeLocalDbStub` smoke import from layout (broke after local-db rewrite)
- [x] `"type": "module"` on `@pos-apps/local-db` for ESM `idb` import

### Residual / accepted
- Enrollment accepts any first 6-digit PIN (documented in README) — Phase 1 demo model, not server PIN registry

## Dev Agent Record

### Completion Notes List

- IndexedDB `pinMaterial` store; enroll/verify/has/clear APIs
- Cashier PIN pad + masked paste input; `/menu` gated on unlock
- Offline unlock when material exists without Account Login token
- `pin-hash` unit tests (3) pass; cashier tsc clean; API 21 tests green

### File List

- packages/local-db/package.json
- packages/local-db/tsconfig.json
- packages/local-db/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/pin-hash.ts
- packages/local-db/src/pin-hash.spec.ts
- packages/local-db/src/pin-material.ts
- apps/cashier/src/app/layout.tsx
- apps/cashier/src/app/page.tsx
- apps/cashier/src/app/pin/page.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/components/pin-pad.tsx
- apps/cashier/src/lib/pin-session.ts
- apps/cashier/src/lib/auth-token.ts
- apps/cashier/src/lib/preferences.ts
- README.md
- _bmad-output/implementation-artifacts/2-2-pos-pin-unlock-online-and-offline-material.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-08-07: Implemented POS PIN unlock + local-db material; review fixes applied; done
