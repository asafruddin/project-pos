# Rubric Walker — Architecture Spine Review

**Spine:** `ARCHITECTURE-SPINE.md`  
**Altitude:** initiative (Phase 1 + Phase 2)  
**Driving spec:** `prd-pos-apps-2026-08-05` (FR-1..FR-112, UJ-1..UJ-9)  
**Brownfield:** `apps/cashier`, `apps/dashboard`, `apps/api` (NestJS), `packages/domain`, `packages/local-db`, `packages/types`  
**Lint:** `lint_spine.py` — `ok: true`, `total_findings: 0` (2026-08-13)  
**Stack check:** npm registry + installed workspace (2026-08-13)  
**Reviewed:** 2026-08-13

## Overall verdict

**Adequate — decision-useful Phase 2 extension, not yet finalize-clean.** Local-primary paradigm, AD-1..AD-11 (unweakened), media isolation (AD-12), ledger SoT (AD-13), extended outbox (AD-14), RBAC (AD-17), shared eval (AD-18), and the operations envelope close the Phase 1 holes from 2026-08-06. What keeps it from “strong” is three one-level-down clashes Phase 2 waves will hit independently: **oversell / negative qty is decided in Deferred while brownfield fail-closes**, **Variant identity is unbound**, and **sellable vs Damaged vs in-transit has no field on the Stock Movement contract**. Mechanical shape (Binds/Prevents/Rule, mermaid, no placeholders) is solid.

---

## Checklist judgment

### 1. Fixes real divergence points for the level below — adequate (misses)

Captures the load-bearing Phase 1 + Phase 2 divergences: local-first Sale (AD-1), completeness gate (AD-2), Sync idempotency (AD-3), single server Stock mutator (AD-4), dependency direction (AD-5), auth split (AD-6), surface split (AD-7), Day Close vs Sync/Shift (AD-8), catalog+image pull (AD-9), price snapshot (AD-10), roles (AD-11), MediaService isolation (AD-12), ledger SoT (AD-13), durable cashier events (AD-14), Nest seams (AD-15), Shift gate (AD-16), API Permission enforcement (AD-17), shared promo/loyalty/price eval (AD-18), Store/Register stub (AD-19).

Misses three divergence points feature/epic teams would hit independently:

| Missed divergence | Why it matters one level down |
| --- | --- |
| Variant vs product identity (FR-37) | Catalog, Cashier Menu, Sale lines, Stock Ledger, and Product Media can each treat a Variant as `product_id`, a child `variant_id`, or a parent+options blob |
| Quantity buckets (sellable / Damaged / in-transit) | AD-13 names in-transit; FR-47 Damaged Stock; movement convention has no bucket — Inventory vs Transfer vs Return will invent incompatible ledgers |
| Hold/park Cart (FR-62) + 2C payment shape | Parked carts are PRD device-local but unbound here; Sync DTO locks singular `payment` while FR-110 requires split tender |

### Findings

- **high** Variant identity unbound — After 2A, Cashier sells a Variant when Variants exist (FR-37). No AD says whether the sellable unit *is* `product_id` (variant rows are products) or a separate `variant_id` on lines, movements, and images. Catalog epic and Checkout/ledger epics can ship incompatible shared data while each citing AD-9 / AD-10 / AD-13. *Fix:* Add AD (or tighten AD-9 + conventions): the line/movement/media foreign key is always the sellable SKU id; a parent with Variants is never a Sale line.
- **high** Stock quantity buckets missing from the movement contract — AD-13 Prevents “two quantity truths” and states in-transit is not sellable at A or B, but the convention shape `{ movement_id, product_id, store_id, qty_delta, reason, source_type, source_id, actor_id, at }` cannot distinguish sellable vs Damaged vs in-transit without overloading `reason` or inventing a fake Store. Return (FR-66) and Transfer (FR-107) will diverge. *Fix:* Add `bucket` (or equivalent) to the movement DTO in `packages/types`; AD-13 Rule: sellable qty = sum of sellable-bucket movements only.
- **medium** Hold/park and split tender unbound — FR-62 parked carts are device-local (not a Sale, no Stock). Silent in ADs, Deferred, and the capability map; a Cashier unit can legally POST parks to the API. Consistency Conventions lock `payment` (singular, Phase 1 cash); FR-110 split cash + Store Credit will force a breaking DTO fork unless versioned now. *Fix:* AD or Deferred ASSUMPTION: parks never leave the device; amend Sync DTO to `payments[]` (or document a 2C additive field) before 2C stories start.

### 2. Every AD Rule is enforceable and prevents its stated divergence — strong with cracks

| AD | Enforceable? | Prevents stated divergence? |
| --- | --- | --- |
| AD-1 | Yes | Yes — no direct API Sale create |
| AD-2 | Yes | Yes — incomplete barred from outbox & server Stock |
| AD-3 | Mostly | Duplicate `sale_id` yes; same `sale_id` + different body (first-write-wins vs reject vs overwrite) unbound |
| AD-4 | Yes | Yes — `AcceptCompleteSale` vs `AdjustStock`; Cashier qty UX-only |
| AD-5 | Direction yes; “rules live in domain” cracked | Mermaid requires `cashier → domain` and `packages/ui`; brownfield has neither. Completeness lives in `packages/local-db`, not `packages/domain` |
| AD-6 | Yes | Yes |
| AD-7 | Yes | Yes |
| AD-8 | Yes | Yes — unsynced ack + no second cash formula |
| AD-9 | Yes | Yes — Menu/images from Local Database after refresh |
| AD-10 | Yes | Yes — snapshot, no re-price on Sync |
| AD-11 | Yes (until 2D) | Yes — `cashier` \| `catalog_admin`; 2D replacement is AD-17, not a silent override |
| AD-12 | Yes | Yes — MediaService-only Cloudinary |
| AD-13 | Mostly | Ledger-as-SoT yes; Damaged/in-transit not expressible (see §1) |
| AD-14 | Pattern yes; keys weak | Sale-like outbox for Shift/Void/Customer yes; Cash In/Out / Void / Customer create have no named idempotency keys in conventions (only `sale_id` / diagram `shift_id`) |
| AD-15 | Fuzzy at table access | Module list is a seed; “don’t reach into another module’s tables” vs brownfield single `schema.ts` |
| AD-16 | Yes | Yes — wave-gated `shift_id`; Phase 1 unchanged until 2C |
| AD-17 | Yes | Yes — API enforce; UI hide insufficient |
| AD-18 | Yes | Yes — one eval in domain; fail-open |
| AD-19 | Yes | Yes — Store #1 stub; no per-line Store pick. Tension: conventions require `store_id`/`register_id` on Sync DTO *now*; brownfield `SyncSaleRequest` has neither; AD-19 says “once the stub exists” |

### Findings

- **medium** AD-3 does not pin same-id/different-body — Brownfield `SalesService.acceptSync` returns `already_accepted: true` without comparing payload (first-write-wins). Spine says “upsert, not insert-again.” Cashier retry with a mutated body vs API reject-if-different are both Rule-legal. *Fix:* Tighten AD-3: first complete body wins; later POSTs with a different body are rejected and must not delete the local Sale.
- **medium** AD-14 idempotency keys unnamed for non-Sale outbox items — Diagram says `sale_id / shift_id`. Cash In/Out, Void, queued Customer create can each invent ids. *Fix:* Convention row: durable cashier events carry a client UUID; API upserts on that id (same as AD-3).
- **low** AD-5 mermaid is not the brownfield graph — See §5. Direction rule (`apps/*` → `packages/*` only) still holds.

*(AD-1, AD-2, AD-4, AD-6–AD-12, AD-16–AD-18: Rules match Prevents.)*

### 3. Nothing under Deferred could let two units diverge unsafely — fail on oversell

Most Deferred items are true late-binding or out-of-scope: exact cloud providers, ESC/POS, CRDT, native shell, card gateway, KDS, in-process jobs, extra apps, custom RBAC, costing method. Those will not let two Phase 2 units ship incompatible cores.

One Deferred bullet is a **binding mutation policy** parked in the wrong section:

> Oversell-on-Sync when ledger would go negative — PRD warns on sell; `AcceptCompleteSale` still posts the movement (warn, not hard-block Instant Checkout). Conflict-report UI deferred

That is an AD (warn + post) plus a UI deferral. Left under Deferred, a 2A Inventory unit will follow it while Instant Checkout / current `packages/domain` stay fail-closed.

### Findings

- **high** Oversell policy in Deferred contradicts brownfield and splits Cashier vs API — PRD FR-50: no hard stop, warn only. Spine Deferred: `AcceptCompleteSale` still posts. Reality:
  - `packages/domain` `acceptCompleteSale` returns `SALE_INSUFFICIENT_STOCK` (spec: “fails closed”)
  - `apps/api` maps that to `ConflictException` and does not insert the Sale
  - `products_stock_qty_nonneg` check forbids negative `stock_qty`
  - `packages/local-db` `completeSale` throws `"Insufficient local stock"` and never enqueues
  AD-4 “Cashier optimistic qty is UX only” would *remove* the local hard-stop, but no AD says Instant Checkout must not block on qty. Two units (Checkout vs Sync/ledger) can each claim compliance. *Fix:* Promote to an AD (wave-gated 2A): Checkout never fail-closes on qty; `AcceptCompleteSale` always posts STOCK OUT (negative sellable allowed); drop/relax the nonneg check at cutover; conflict-report UI stays Deferred. Until 2A, explicitly ratify Phase 1 fail-closed so stories do not “fix forward” early.

### 4. Named tech is verified-current — strong

Verified 2026-08-13 against npm `latest` and installed brownfield:

| Spine pin | Reality | Fit |
| --- | --- | --- |
| TypeScript ^5.8 (workspace) | workspace `^5.8.2`; npm `latest` **7.0.2** | OK — ratifies install, does not chase TS 7 |
| pnpm 11.20.0 · turbo ^2.10.0 | `packageManager` 11.20.0; turbo latest **2.10.9** | OK |
| Next.js 16.3.0 | npm **16.3.0** | OK |
| React 19.2.8 | npm **19.2.8** | OK |
| @nestjs/core ^11.1.0 | latest **11.1.29** | OK |
| PostgreSQL 16.x managed | PG 16 supported through 2028-11; current majors 16–18 (19 beta) | OK as managed pin |
| Drizzle ORM 0.45.1 | installed 0.45.1; latest **0.45.2** | OK — brownfield pin |
| @serwist/next ^9.0.14 | latest **9.5.12** | OK |
| Cloudinary Node SDK 2.10.x | npm `cloudinary@2.10.0` | OK — not installed yet; pin is current |

### Findings

- **low** `idb` used by brownfield, absent from Stack — `packages/local-db` depends on `idb@^8.0.3` (npm 8.0.3). IndexedDB is named in the paradigm; the library is not pinned. Two local-db stories could still reach for Dexie. *Fix:* Add Stack row `idb ^8.0.3` (code-owned).
- **low** TypeScript 7 is npm latest — Spine correctly keeps workspace 5.8. Not a fail; note only if a later scaffold story reads “latest TypeScript.”

### 5. Ratifies rather than contradicts brownfield — adequate (target-state drift)

Ratified well: three apps, NestJS modules Auth/Catalog/Sales, `packages/domain` + `local-db` + `types`, local-first Sale + outbox, `sale_id` UUID, `incomplete` \| `complete`, PIN material in IndexedDB, catalog pull `replaceCatalog`, price snapshot on lines, `RolesGuard` `cashier` \| `catalog_admin`, integer minor units, `{ code, message }` errors, Bearer after login, Serwist PWA, Drizzle + Postgres `stock_qty` on product (Phase 1).

Contradicts or invents:

| Spine | Brownfield |
| --- | --- |
| `packages/ui` in paradigm, AD-5 mermaid, structural seed | **Does not exist**; cashier and dashboard duplicate `components/ui/*` |
| `cashier → domain`, `dashboard → domain` | Only `apps/api` depends on `@pos-apps/domain` |
| AD-5: Sale completeness rules live in `packages/domain` | Completeness transition is `local-db` `completeSale` (payment + Receipt) |
| AD-15: Identity, Inventory, Purchasing, Media, … | `AuthModule`, `CatalogModule` (owns `AdjustStock`), `SalesModule`; one `schema.ts` |
| Sync DTO includes `store_id`, `register_id`, `shift_id?` | `SyncSaleRequest` is `{ sale_id, device_id, completed_at, payment, lines }` |
| Identity module name | `auth/` |
| Oversell post-anyway (Deferred) | Fail-closed in domain + DB check + local-db (see §3) |

Seed for Phase 2 modules/Cloudinary is allowed; treating `packages/ui` and `cashier → domain` as *current* graph is not ratification.

### Findings

- **medium** Structural seed / AD-5 mermaid invent `packages/ui` and cashier/dashboard domain edges — Skill bar: ratify conventions the code already shows. Extracting `packages/ui` is a refactor, not an existing invariant. *Fix:* Draw the brownfield graph (cashier → local-db + types; dashboard → types; api → domain + types). Put `packages/ui` and cashier-domain eval under Deferred until AD-18 lands, or mark `[ASSUMPTION]` extraction.
- **medium** Sync DTO convention is already ahead of the stub — AD-19 “once the stub exists” vs conventions listing `store_id`/`register_id` as required now. A Sync story adding required fields will break current Cashier `toSyncSaleRequest`. *Fix:* Convention: Phase 1 DTO as in `packages/types`; `store_id`/`register_id`/`shift_id` additive at stub/2C (optional then required per wave).
- **low** Money convention does not ratify IDR — Brownfield `formatIdr` / types comment: integer rupiah, no fractional subunit. Spine says only “integer minor units.” *Fix:* One convention cell: Phase 1+2 currency is IDR, `*_minor` = whole rupiah.

### 6. Covers driving PRD capabilities — strong with map holes

| Capability | Lives in / Governed by | Coverage |
| --- | --- | --- |
| Account Login + POS PIN (FR-1–5, UJ-1–2) | AD-6, AD-11 | Covered |
| Instant Checkout (FR-6–13, UJ-1) | AD-1, AD-2, AD-10, AD-18 | Covered; fail-open decorations named |
| Offline Mode + Sync (FR-14–21, UJ-2) | AD-1, AD-3, AD-4, AD-9 | Covered |
| Day Close (FR-22–27, FR-111, UJ-3, UJ-8) | AD-8 | Covered |
| Catalog + Product Media (FR-33–43, UJ-4) | AD-9, AD-12 | Covered except Variant identity (§1) |
| Stock Ledger / Opname / Adjustment (FR-44–54, UJ-5) | AD-4, AD-13 | Covered except buckets + oversell (§1, §3) |
| Purchasing / GR (FR-55–61, UJ-6) | AD-13, AD-15 | Covered at initiative altitude |
| Void / Return / Refund (FR-63–69, UJ-7) | AD-14, AD-11, AD-17 | Covered; Exchange = new Sale (FR-68) not named |
| Hold/park (FR-62) | — | **Missing** |
| Customers / Loyalty (FR-70–86, UJ-9) | AD-14, AD-18 | Covered; earn-on-Sync vs local Points implied by “redeem online-first,” not explicit |
| Shift (FR-75–81, UJ-8) | AD-14, AD-16 | Covered |
| Split tender / Store Credit (FR-110, FR-68) | — | **Missing** (and fights singular `payment`) |
| Promotions (FR-87–92) | AD-18, AD-10 | Covered |
| Reports (FR-31, FR-93–97) | — | FR-31 thin list implied; 2D analytics **unmapped** |
| RBAC (FR-98–103) | AD-11, AD-17 | Covered |
| Multi-Store / Transfer (FR-104–109) | AD-19, AD-13 | Covered at stub altitude; in-transit hole in §1 |

Binds header `FR-1..FR-112, UJ-1..UJ-9` matches the spec. Deferred list matches PRD §5 non-goals (CRDT, KDS, card, native shell, worker app, extra apps).

### Findings

- **medium** Capability map omits hold/park, reports, split tender — Initiative map is the consistency auditor’s checklist. 2B/2C/2D epics will not find a governing AD. *Fix:* Add rows (even if “Deferred: device-local parks”; “reports online-first Dashboard, cost-field COGS”; “payments[] at 2C”).
- **low** Loyalty earn timing — FR-83: offline Sale does not invent Points; earn after Sync. AD-18 owns eval location, not when points post. *Fix:* One sentence under AD-18 or AD-4: Points are a server side-effect of accepted complete Sale (online rules), never a local-db field.

### 7. AD-1..11 must not be weakened — pass

Phase 2 amends AD-4, AD-7, AD-8, AD-9, AD-11. None drop a Phase 1 gate:

| AD | Phase 2 change | Weakened? |
| --- | --- | --- |
| AD-1 | Unchanged; AD-14 extends the *pattern* to other events, not a bypass | No — still no direct API Sale create |
| AD-2 | Status still `incomplete` \| `complete` only | No |
| AD-3 | Unchanged | No |
| AD-4 | `stock_qty` becomes ledger projection; named commands | No — still only `apps/api` mutates server qty; AdjustStock still not used by Sync |
| AD-5 | Cloudinary SDK banned from domain | Stronger |
| AD-6 | Unchanged; AD-11 still: PIN grants no extra Permissions | No |
| AD-7 | No third app; multi-Store not in Instant Checkout | Stronger |
| AD-8 | Shift cash display; still cannot finish with unsynced Sales unless ack | No |
| AD-9 | Durable image cache added | Stronger; still Menu from Local Database |
| AD-10 | Snapshots after Customer/Store/Promotion eval | No — still no re-price on Sync |
| AD-11 | “Until 2D” + mapping FR-103; AD-17 is the 2D replacement | No — Phase 1 `cashier` \| `catalog_admin` remains until 2D; catalog mutate still not cashier |

AD-16 explicitly: “Phase 1 (no Shift module) is unchanged until this wave.” AD-18: completeness (AD-2) never waits on Media/Loyalty/Promotion. No new AD contradicts an inherited Phase 1 AD.

### Findings

None on this criterion.

### 8. Every dimension this altitude owns is decided, deferred, or open — ops envelope present; remainder thin

**Decided:** paradigm, app/package shape, Sale/Sync/Stock/Auth/Media/ledger/outbox/RBAC/eval/tenancy invariants, conventions, stack seed, capability map, ops table (Vercel ASSUMPTION for Next; Cloudinary; `local` · `preview` · `production`; secrets not in client).

**Deferred:** exact API/DB providers, ESC/POS, CRDT, native shell, card, KDS, worker/queue, extra apps, custom roles, costing, conflict-report UI, oversell UI (policy should not live here — §3).

**Open questions:** none on the spine (memlog still has host/ESC/POS). Acceptable if Deferred covers them.

**Silent (initiative still owns enough to keep features from forking):**

- Observability / logging / tracing / error reporting
- Backups / PITR on managed Postgres
- CI/CD beyond “preview” as an env name
- JWT refresh vs re-login when Sync retries after expiry (cashier `authorizedFetch` currently logs out)

Ops envelope itself is **no longer silent** — that 2026-08-06 high finding is closed. Remaining ops gaps are the leftover of “operations.”

### Findings

- **medium** Observability and token-expiry-during-Sync are silent — Two units can pick Sentry vs console, and drop vs preserve outbox on 401. AD-3 says retry and do not delete the local Sale; it does not say expired Bearer must re-login without poisoning the outbox. *Fix:* Deferred bullets: “no product observability platform until first prod story”; “expired access token: re-Account-Login, outbox retained (AD-3).”
- **low** API host + DB provider still Deferred while Next is Vercel ASSUMPTION — Consistent with memlog; not a silent dimension.

### 9. Mechanical floor — strong

- Placeholders: none (`TODO`/`TBD`/`FIXME`; template `{tokens}` only inside mermaid/text fences, skipped by lint).
- AD-1…AD-19: contiguous, each with **Binds** / **Prevents** / **Rule**; `[ADOPTED]` where brownfield/PRD settled.
- Mermaid: dependency flowchart, system flowchart, ERD — syntactically valid.
- `lint_spine.py`: `ok: true`, `total_findings: 0`.
- ASSUMPTION used on Vercel host only; not used as a fake AD.

---

## Severity rollup

| Severity | Count | Themes |
| --- | --- | --- |
| critical | 0 | — |
| high | 3 | Oversell/negative qty (Deferred vs brownfield fail-closed); Variant identity; Stock buckets (sellable/Damaged/in-transit) |
| medium | 7 | Hold/park + split `payment`; AD-3 body mismatch; AD-14 event ids; mermaid/`packages/ui` vs code; Sync DTO ahead of stub; capability-map holes; silent observability/token-expiry |
| low | 5 | `idb` unpinned; IDR unratified; Loyalty earn timing; Identity vs `auth/` naming; TS 7 vs workspace 5.8 (informational) |

**Gate recommendation:** Before Finalize — (1) promote oversell to a wave-gated AD and state Phase 1 fail-closed until 2A cutover, (2) bind sellable SKU / Variant identity, (3) add quantity `bucket` to the movement DTO. Then fold hold/park, `payments[]`, and brownfield mermaid ratification. Re-walk.

**AD-1..11:** not weakened. **Ops envelope:** present (Vercel ASSUMPTION, envs, secrets, Cloudinary; API/DB provider Deferred). **Lint:** clean.

---

## What is already good (do not churn)

- Local-primary paradigm and AD-1 “no online POST Sale” still the right Instant Checkout invariant; AD-16/AD-18 protect it from Shift and decorations.
- AD-9 + AD-12 correctly isolate Cloudinary from Menu/Checkout/Receipt/Sync after catalog refresh (PRD SM-10 / addendum).
- AD-13 + AD-4 cutover (opening movement; `stock_qty` projection; AdjustStock ≠ Sync) is the right 2A ledger move — it needs buckets and oversell, not a rewrite.
- AD-14 matches addendum durable cashier events; Returns/Loyalty redeem stay online-first.
- AD-11 “until 2D” + AD-17 API enforce preserves FR-32 while allowing FR-98–FR-103.
- Capability map + ops table + Cloudinary 2.10.x pin close the 2026-08-06 rubric highs (online Sale path, catalog refresh, silent deploy envelope).
- Stack pins match installed brownfield and current npm lines (Cloudinary 2.10.0, Next 16.3.0, React 19.2.8, Nest 11.1.x, Serwist 9.x).
