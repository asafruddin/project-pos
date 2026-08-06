# Version reality-check — Architecture Spine Stack

**Checked:** 2026-08-06 (npm registry `latest` unless noted)  
**Source:** `ARCHITECTURE-SPINE.md` § Stack  
**Verdict:** **PASS** — committed version ranges match current npm reality. No pin is outdated. One Stack line (PWA) still names a dead alternative.

## npm pins checked

| Spine pin | Package | npm `latest` | Fit |
| --- | --- | --- | --- |
| Next.js 16.3.x | `next` | **16.3.0** | OK — matches `latest`; canary `16.3.1-canary.*` exists |
| turbo 2.10.x | `turbo` / `create-turbo` | **2.10.8** | OK — `create-turbo@latest` resolves same line |
| NestJS `@nestjs/core` 11.1.x | `@nestjs/core` | **11.1.28** | OK — alive; `next` tag is 12 alpha (do not jump) |
| Drizzle ORM 0.45.x | `drizzle-orm` | **0.45.2** | OK — stable `latest`; `rc`/`beta` tags at 1.0.0-rc.* (watch, not pin-break) |
| idb 8.0.x | `idb` | **8.0.3** | OK — exists, not deprecated, fits IndexedDB local-db |

## Non-npm / soft Stack entries

| Spine entry | Reality | Flag |
| --- | --- | --- |
| TypeScript (workspace latest via starter) | `typescript` `latest` = **7.0.2** | Soft — not a pin; starter will resolve at scaffold |
| PostgreSQL 16.x managed | Major 16 still current/supported; 17+ also shipping | Soft assumption OK for Phase 1; not outdated |
| pnpm + Turborepo via `create-turbo@latest` | `create-turbo` **2.10.8** | OK |

## Serwist vs next-pwa

| Package | Version / last activity | Status |
| --- | --- | --- |
| `@serwist/next` / `serwist` | **9.5.12** (published ~2026-07-22) | **Active** — Next.js docs cite Serwist for SW/offline caching; peer `next >=14` |
| `next-pwa` (shadowwalker) | **5.6.0**, last publish **2022-08-23** | **Abandoned** — do not pick |
| `@ducanh2912/next-pwa` | **10.2.9**, modified ~2024-09; maintainers steer to Serwist | **Superseded** |

Spine already prefers `[ASSUMPTION: Serwist]` — correct. Listing “Serwist **or** next-pwa” as a co-equal scaffold choice is the only stale wording.

## Outdated pins

**None** among the committed version ranges (`16.3.x`, `2.10.x`, `11.1.x`, `0.45.x`, `8.0.x`).

### Non-pin staleness (editorial)

- **PWA line:** drop `next-pwa` as an option; pin scaffold to `@serwist/next` (Serwist 9.x).
- **Watch (not fail):** `drizzle-orm` 1.0 RC on `rc` tag — re-check before locking deps if RC stabilizes.

## Summary

All named npm version bands were web/npm reality-checked and still fit. Stack is safe to scaffold from; tighten PWA wording to Serwist-only.
