# Rubric Walker — Architecture Spine Review

**Spine:** `ARCHITECTURE-SPINE.md`  
**Altitude:** initiative (Phase 1)  
**Driving spec:** `prd-pos-apps-2026-08-05` (FR Instant Checkout, Offline Mode, Day Close, Dashboard)  
**Lint:** `lint_spine.py` — 0 mechanical findings  
**Reviewed:** 2026-08-06

## Overall verdict

**Adequate — decision-useful draft, not yet finalize-clean.** Local-primary paradigm, AD-1–AD-8, conventions, capability map, and mermaid seed correctly pin the offline/sync/stock divergences Phase 1 features would otherwise invent incompatibly. Named stack lines match current npm (2026-08-06). What keeps it from “strong” is a **silent operational/deploy envelope** (decided in memlog, absent from the spine), an **online Sale write-path ambiguity** (AD-4 “online create” vs AD-1 local-primary), and a **missing catalog-refresh contract** for Offline Mode. Mechanical shape (AD Binds/Prevents/Rule, valid mermaid, no placeholders) is solid.

---

## Checklist judgment

### 1. Fixes real divergence points for the level below — adequate (misses)

Captures the high-value Phase 1 divergences: Sale SoT (AD-1), completeness → Sync/Stock gate (AD-2), Sync idempotency (AD-3), Stock mutation owner (AD-4), monorepo dependency direction (AD-5), Account Login vs offline POS PIN (AD-6), Cashier-only Offline Mode (AD-7), Day Close vs unsynced Sales (AD-8).

Misses two divergence points feature teams would hit independently:

| Missed divergence | Why it matters one level down |
| --- | --- |
| Online Sale write path | Instant Checkout online vs Offline Sync could dual-write differently (direct API create vs always Local DB → outbox) |
| Catalog → Local Database refresh | Offline sell (FR-14/FR-29) needs a shared rule for how/when Cashier materializes server catalog |

### Findings
- **high** Online Sale path under-specified (AD-1 vs AD-4) — Paradigm + AD-1 make Local Database authoritative for complete-but-unsynced Sales; AD-4 Rule allows Stock mutation on “**online create or Sync**,” implying a second Sale-create path that bypasses the outbox. Two feature units can ship incompatible Instant Checkout write models. *Fix:* One rule — e.g. “all complete Sales are written Local DB first; Sync (or immediate Sync when online) is the only server ingest” — or explicitly define online create as the same Sync accept endpoint with `synced=true` ack.
- **medium** Catalog refresh / Local materialization has no AD — Paradigm names server as catalog SoT; diagram edge is “Account Login catalog online”; capability map folds FR-28–32 under AD-4/AD-7. No enforceable rule for pull-on-login vs periodic refresh, stale-offline catalog, or delete/disable propagation (FR-29). *Fix:* Add AD (or Deferred with a single interim ASSUMPTION) for catalog download into `packages/local-db`.

### 2. Every AD Rule is enforceable and prevents its stated divergence — strong with one crack

| AD | Enforceable? | Prevents stated divergence? |
| --- | --- | --- |
| AD-1 | Yes | Yes — Local SoT while unsynced |
| AD-2 | Yes | Yes — incomplete barred from outbox & server Stock |
| AD-3 | Yes | Yes — idempotent `sale_id`; non-blocking retry; status ≠ incomplete |
| AD-4 | Mostly | Cracked by “online create” vs local-primary (see above) |
| AD-5 | Yes | Yes — apps→packages; domain purity; mermaid matches |
| AD-6 | Yes | Yes — offline PIN without live Account Login |
| AD-7 | Yes | Yes — Offline Mode / Local DB only in cashier |
| AD-8 | Yes | Yes — Day Close cannot silently drop unsynced Sales |

### Findings
- **high** AD-4 Rule does not fully prevent its Prevents clause under dual ingest — “Cashier and API both permanently mutating the same Stock ledger incompatibly” is blocked for *Stock writers*, but “online create” still lets Cashier/API disagree on *when a Sale exists on the server*, which is the Stock trigger. Same fix as checklist §1.

*(AD-1–AD-3, AD-5–AD-8: no separate findings — Rules match Prevents.)*

### 3. Nothing under Deferred could let two units diverge unsafely — adequate

Deferred items are mostly true out-of-scope or late-binding choices (CRDT, native shell, card gateway, KDS, worker app, UI package depth). “Exact Postgres host … and ESC/POS library — choose in first infra story” is safe *if* the rest of the deploy envelope is named elsewhere.

### Findings
- **high** Deploy/env envelope silent in spine (not decided, not deferred as a dimension) — Memlog records `Deploy ASSUMPTION: Vercel for Next apps; API Node host + managed Postgres`, but the spine only soft-defers “Exact Postgres host.” Feature teams can still pick incompatible app hosting, env topology, or API placement. Checklist treats silent operational/deploy envelope as a finding at this altitude. *Fix:* Promote the memlog deploy ASSUMPTION into Stack/Structural Seed (or Deferred as one explicit “deploy topology” bullet covering apps + API + DB + envs).
- **low** PWA library dual-named (Serwist **or** next-pwa) with Serwist ASSUMPTION — Acceptable seed ambiguity; two cashiers scaffolds could still diverge until scaffold story picks one. *Fix:* Pin Serwist only in Stack (drop the “or”).

### 4. Named tech is verified-current — strong

Verified against npm 2026-08-06:

| Spine pin | Live check |
| --- | --- |
| Next.js 16.3.x | `next@16.3.0` ✓ |
| @nestjs/core 11.1.x | `11.1.28` ✓ |
| turbo 2.10.x | `2.10.8` ✓ |
| drizzle-orm 0.45.x | `0.45.2` ✓ |
| idb 8.0.x | `8.0.3` ✓ |
| serwist | `9.5.12` exists ✓ |
| PostgreSQL 16.x managed | Reasonable ASSUMPTION for managed hosts ✓ |

### Findings
- **low** TypeScript unpinned — “`(workspace latest via starter)`” is not a verified version line; lint did not flag it, but verified-current bar wants a pin or an explicit “inherits create-turbo default” Deferred. *Fix:* Pin `typescript` major.minor (e.g. 5.9.x) or move to Deferred.

### 5. Covers driving PRD capabilities — strong

| Capability | Lives in / Governed by | Coverage |
| --- | --- | --- |
| Instant Checkout (FR-6–13) | cashier + domain · AD-2 | Covered |
| Offline Mode + Sync (FR-14–21) | cashier local-db + api · AD-1, AD-3 | Covered (catalog refresh gap above) |
| Day Close (FR-22–27) | cashier · AD-8 | Covered; aligns with FR-24 hard warn + ack |
| Dashboard products / Stock (FR-28–32) | dashboard + api · AD-4, AD-7 | Covered; FR-32 roles only weakly bound |
| Account Login + POS PIN | AD-6 | Covered |
| Receipt | AD-2 + PRD §8 | Covered at architecture altitude |

### Findings
- **medium** FR-32 role separation unbound — Capability map and AD-6 cover auth *mechanism* (Account Login vs PIN), not *authorization* (catalog role vs cashier-only). Dashboard and API feature work can invent incompatible role checks. *Fix:* Extend AD-6 (or add AD) — roles enforced in `apps/api`; Dashboard UI hides; Cashier never gets catalog-mutate tokens.

### 6. Every dimension this altitude owns is decided, deferred, or open — thin on ops

Decided: paradigm, monorepo shape, apps/packages, Sale/Sync/Stock/Auth/Day Close invariants, consistency conventions, stack seed.  
Deferred: CRDT, native shell, card, KDS, worker, UI depth, exact Postgres host, ESC/POS.  
Open questions: none listed in spine (memlog has host/ESC/POS as questions — OK if Deferred).

Silent: **deployment & environments**, **API/app hosting topology**, **config/secrets**, **observability** — initiative altitude owns enough of this to keep features from forking infra.

### Findings
- **high** Silent operational/deploy envelope — Same as §3; called out here as the dimension failure mode the good-spine checklist names explicitly. *Fix:* Decide or Deferred the full envelope (Next host, API host, managed Postgres, local/prod envs) in one place on the spine.
- **medium** `api-client` named in paradigm package list but absent from Structural Seed and dependency mermaid — Cold-start units can invent parallel HTTP clients. *Fix:* Add `packages/api-client` to tree + mermaid edges, or remove from paradigm list until extracted.

### 7. No placeholders; valid mermaid; AD ids stable with Binds/Prevents/Rule — strong

- Placeholders: none (`TODO`/`TBD`/`{…}`); ASSUMPTION tags used correctly.
- AD-1…AD-8: contiguous, each with **Binds** / **Prevents** / **Rule**; tags `[ASSUMPTION]` / `[ADOPTED]` present.
- Mermaid: dependency flowchart (AD-5), system flowchart, ERD — syntactically valid; ERD relationships coherent for initiative seed.
- `lint_spine.py`: `ok: true`, `total_findings: 0`.

### Findings
- **low** Paradigm `packages/*` comment lists `api-client` not shown in seed (covered under §6).
- **low** ERD puts `stock_qty` on PRODUCT without local-vs-server qualifier — Fine at seed altitude given AD-4; optional note if readers confuse Cashier optimistic qty with Dashboard truth.

---

## Severity rollup

| Severity | Count | Themes |
| --- | --- | --- |
| critical | 0 | — |
| high | 3 | Online Sale path (AD-1/AD-4); silent deploy/env envelope; (deploy also under Deferred safety) |
| medium | 3 | Catalog refresh AD; FR-32 roles; api-client seed drift |
| low | 3 | TypeScript unpinned; PWA dual option; ERD stock_qty clarity |

**Gate recommendation:** Apply clear autofixes before Finalize — (1) resolve online Sale = local-first+Sync-only vs true dual ingest in AD-4/AD-1, (2) land deploy ASSUMPTION from memlog into spine Stack/Deferred, (3) add catalog-refresh AD or Deferred ASSUMPTION. Then re-walk.

---

## What is already good (do not churn)

- Local-primary paradigm sentence is the right Phase 1 invariant.
- AD-2 completeness gate + AD-3 idempotent Sync + AD-8 Day Close ack match the final PRD.
- AD-5 dependency mermaid is the right monorepo rule shape.
- Capability → Architecture Map covers all four driving pillars.
- Stack pins are current; NestJS swap from earlier Hono memlog decision is reflected in the spine.
