# Spine Pair Review — POS Apps

## Overall verdict

The spine pair is an **adequate** downstream contract: PRD UJ-1–3 map to Key Flows with protagonists, climax, and failure handling; DESIGN.md is a clean shadcn brand-layer delta with resolvable tokens; EXPERIENCE.md carries the behavioral Sale/Sync/offline invariants. Gaps that will bite implementers are missing contrast targets for brand colors, Dashboard/Day Close visual thinness, and (expected) empty visual refs pre-mock Finalize. Not broken — consumers can source-extract, with a short fix list before treating the pair as final.

## 1. Flow coverage — adequate

Checked EXPERIENCE.md Key Flows against PRD §2.3 UJs (and epics UJ coverage line). Sources: `prd.md` UJ-1–3; Flow 4 covers Dashboard/Stock (FR-28–32 / memlog secondary persona), not a named PRD UJ.

| Source UJ | Flow | Protagonist | Steps | Climax | Failure |
|---|---|---|---|---|---|
| UJ-1 Dewi rings up… Receipt | Flow 1 Instant Checkout | Dewi | 1–6 | Receipt → Sale complete | Receipt fail → incomplete |
| UJ-2 Dewi keeps selling offline | Flow 2 Offline Mode | Dewi | 1–4 | Complete Sale offline | Sync fail does not block next Sale |
| UJ-3 Dewi closes cashier | Flow 3 Day Close | Dewi | 1–4 | Report matches → Login | Unsynced → block / acknowledge |
| (no PRD UJ; Dashboard FRs) | Flow 4 Stock the shop | Raka | 1–4 | Stock/list reflect Sync | cashier mutate → 403 / UI disable |

### Findings

- **[medium]** Key Flow titles use pillar names ("Instant Checkout", "Offline Mode", "Day Close") but never cite **UJ-1 / UJ-2 / UJ-3** verbatim as in PRD §2.3 (EXPERIENCE.md § Key Flows). *Fix:* Prefix headers e.g. `### Flow 1 — UJ-1 Instant Checkout (Dewi…)`.
- **[low]** Flow 3 embeds the unsynced edge as step 2 rather than a labeled `Failure:` beat like Flows 1 and 4 (EXPERIENCE.md Flow 3). *Fix:* Add a one-line Failure/edge callout for FR-24 acknowledge vs Sync-complete paths.
- **[low]** Flow 1 climax is Receipt success; PRD resolution ("Stock on Dashboard updates") is only step 6 — acceptable, but easy to miss for story-dev mapping SM-1 (EXPERIENCE.md Flow 1). *Fix:* Tag step 6 as Resolution / Stock update for the online path.

## 2. Token completeness — adequate

Extracted DESIGN.md YAML tokens and all `{path.to.token}` refs in both spines. Hex present on all color tokens. Spec: `references/design-md-spec.md`.

**Defined colors (hex):** `primary`, `primary-foreground`, `accent`, `accent-foreground`, `primary-dark`, `primary-foreground-dark`, `accent-dark`, `accent-foreground-dark`, `sync-waiting`, `sync-ok`, `offline-banner`.

**Typography / rounded / spacing / components:** All frontmatter keys used in refs resolve except informal shorthand noted below. EXPERIENCE refs `{spacing.tap-min}` / `{spacing.tap-comfortable}` resolve.

### Findings

- **[high]** No **contrast targets** stated for load-bearing combinations (primary on surface, accent/sync-waiting chip + foreground, offline-banner + `#F8FAFC`, sync-ok on surface) despite EXPERIENCE Accessibility Floor claiming brand blue/amber are "checked" (DESIGN.md Colors; EXPERIENCE.md Accessibility Floor). *Fix:* Add AA (or measured) ratios for those pairs in DESIGN.md Colors, including dark variants.
- **[medium]** Status tokens `sync-waiting`, `sync-ok`, `offline-banner` have light hex only — no dark pairs while primary/accent do (DESIGN.md frontmatter). *Fix:* Add `*-dark` (or document inherit/same) for status colors used on Cashier chrome in both themes.
- **[low]** Prose uses non-resolvable shorthand `{rounded.sm/md/lg}` (DESIGN.md Shapes). *Fix:* Write `{rounded.sm}` / `{rounded.md}` / `{rounded.lg}` separately.
- **[low]** `spacing.cart-gutter` and `spacing.menu-tile-gap` are defined but never referenced in body or components (DESIGN.md frontmatter). *Fix:* Wire into Layout/Components or drop until used.
- **[low]** `offline-banner` component hardcodes foreground `#F8FAFC` instead of a named token (DESIGN.md components.offline-banner). *Fix:* Add `offline-banner-foreground` (and dark) to `colors`.

## 3. Component coverage — adequate

Cross-walked names appearing in DESIGN Components / frontmatter `components` and EXPERIENCE Component Patterns. shadcn-as-is list is declared; brand-layer POS pieces are the load-bearing set.

| Name | DESIGN visual | EXPERIENCE behavior |
|---|---|---|
| Button primary / button-primary | ✓ | (inherit + tap via Checkout pay / PIN) |
| Pay / button-cashier-pay / Checkout pay | ✓ | ✓ |
| Product tile | ✓ | ✓ |
| Cart Panel | ✓ | (layout IA; line behavior under Cart line) |
| Cart line | — | ✓ |
| PIN pad | ✓ | ✓ |
| Sync chip | waiting token ✓ | synced / waiting / retrying ✓ |
| Offline banner | ✓ | ✓ |
| Receipt confirm / Receipt gate | ✓ | ✓ |
| Day Close blocker | — | ✓ |
| Product form | — (shadcn forms) | ✓ |
| Sales table | — (Table as-is) | ✓ |

### Findings

- **[medium]** **Day Close** (blocker + report confirm) has strong behavior but no DESIGN.md Components row for layout/CTA/acknowledge affordance (EXPERIENCE Component Patterns; DESIGN Components). *Fix:* Add a Day Close / acknowledge-dialog visual row (inherits Dialog + primary/destructive rules).
- **[medium]** **Cart line** (qty stepper, remove) is behavioral-only; DESIGN only specs Cart Panel shell (EXPERIENCE Component Patterns; DESIGN Components). *Fix:* One row for cart line / stepper min heights and `{typography.cashier-price}`.
- **[medium]** Name drift: DESIGN **Receipt confirm** vs EXPERIENCE **Receipt gate**; DESIGN **Pay / complete CTA** vs EXPERIENCE **Checkout pay** (both spines Components). *Fix:* Pick one canonical name per pattern and use identically in both files.
- **[low]** Sync chip visual token covers **waiting** only; synced / retrying lack component tokens (DESIGN components.sync-chip-waiting; EXPERIENCE Sync chip states). *Fix:* Add `sync-chip-ok` using `{colors.sync-ok}` (+ retrying = accent or muted rule).
- **[low]** Dashboard **Product form** / **Sales table** lean entirely on "shadcn as-is" with no DESIGN pointer row (EXPERIENCE Component Patterns). *Fix:* One-line "inherit Table/Input/Button; no brand delta" in DESIGN Components for extractability.

## 4. State coverage — adequate

Walked IA surfaces (EXPERIENCE Information Architecture) against State Patterns + Component Patterns + Key Flows.

| Surface | Covered states | Gap |
|---|---|---|
| Account Login | Wrong credentials; cold load | Offline Account Login on Cashier not specified |
| POS PIN | Wrong PIN; offline ± PIN material | — |
| Cashier Menu | Empty catalog; cold; offline sell | — |
| Cart Panel | (Checkout gated ≥1 line) | Empty-cart guidance not explicit |
| Checkout | Pay does not complete Sale | Payment-record failure / abort |
| Receipt | Incomplete + retry/cancel | — |
| Sync | Waiting; fail keeps Sale complete | — |
| Day Close | Unsynced hard block / acknowledge; after confirm → Login | Empty report day |
| Products / Stock | catalog_admin vs cashier | — |
| Sales list | Empty before first Sync | — |
| Settings | Theme override | — |

### Findings

- **[medium]** No state for **Checkout payment failure** or abandon-before-Receipt (EXPERIENCE State Patterns / Checkout). *Fix:* Add row: payment fail or back-out → Sale not started/incomplete; Stock unchanged; return to Cart.
- **[medium]** Cashier **Account Login while offline** (first launch / post–Day Close with no network) unspecified; UJ-2 assumes PIN material already present (EXPERIENCE State Patterns; Foundation). *Fix:* State row: offline + no session → clear fail / cannot fake Login (symmetric to missing PIN material).
- **[low]** Empty **Cart Panel** (zero lines) has enablement rule on Checkout but no empty treatment/copy (EXPERIENCE State Patterns). *Fix:* Empty cart: hide/disable Pay; optional Voice line.
- **[low]** State Patterns table header is `| State | Treatment |` but the cold-load row has three cells (State | Surface | Treatment) (EXPERIENCE.md State Patterns). *Fix:* Normalize to three columns everywhere (match Drift example).

## 5. Visual reference coverage — thin

Listed workspace visual dirs: `imports/` exists and is **empty**; `mockups/` and `wireframes/` are **absent**. EXPERIENCE states spines win on conflict once (lede). No inline links to visual artifacts (none to link).

### Findings

- **[medium]** No mockups/wireframes/imports artifacts and no inline visual references for Cashier Menu+Cart, Offline banner, Day Close, or Dashboard (workspace `imports/`; missing `mockups/`, `wireframes/`). *Expected* at pre-mock Finalize — score stays thin until Finalize attaches and links files. *Fix:* After mocks exist, link each at IA / Key Flow / Component sections (`→ Composition reference: mockups/….html`) and keep spines-win statement once.
- **[low]** Example spines link mockups from IA; this pair has no placeholder paths for planned screens (EXPERIENCE Information Architecture). *Fix:* Optional stub paths in memlog or IA comments listing intended mock filenames so Finalize does not invent IA.

## 6. Bloat & overspecification — strong

DESIGN.md editorial voice is appropriate for Brand & Style; EXPERIENCE stays mostly tables + short rules. Little PRD dump; Key Flows are compressed journeys, not FR restatements. Minor repetition only.

### Findings

- **[low]** Brand & Style repeats "warm" / cafe-adjacent trust in consecutive paragraphs (DESIGN.md Brand & Style). *Fix:* Collapse to one posture paragraph.
- **[low]** Flow 4 names architecture path `AdjustStock` — useful for inheritance, slightly source-leaky for a UX spine (EXPERIENCE Flow 4). *Fix:* Prefer glossary "Stock qty edit" and leave AdjustStock to architecture/stories unless intentionally bridging.

## 7. Inheritance discipline — adequate

`sources` frontmatter paths resolve to existing `prd.md`, `ARCHITECTURE-SPINE.md`, and `epics.md`. Glossary terms (Account Login, POS PIN, Cashier Menu, Cart Panel, Checkout, Sale, Receipt, Local Database, Sync, Stock, Dashboard, Day Close, Today's Sales Report) match PRD §3 usage. EXPERIENCE token refs resolve into DESIGN. Component naming not fully identical across files (see §3).

### Findings

- **[medium]** UJ identifiers from PRD (**UJ-1**, **UJ-2**, **UJ-3**) are not carried into EXPERIENCE Key Flow headers; epics phrase them as "UJ-1 Instant Checkout" etc. (EXPERIENCE Key Flows vs prd.md §2.3). *Fix:* Use verbatim UJ-n + short title in flow headers.
- **[medium]** Cross-spine component aliases (Receipt confirm/gate, Pay CTA/Checkout pay, Sync chip waiting-only) undermine clean extract (DESIGN.md Components; EXPERIENCE Component Patterns). *Fix:* Same as §3 — single canonical names.
- **[low]** DESIGN `status: draft` / EXPERIENCE `status: draft` while memlog says Finalize started (both frontmatter; `.memlog.md`). *Fix:* Keep draft until mock+contrast fixes land; then `final`.
- **[low]** EXPERIENCE Foundation cites "demo/portfolio Phase 1" stakes already owned by PRD — mild restatement (EXPERIENCE Foundation). *Fix:* One clause pointing at PRD scope; drop duplicate out-of-scope list if IA Out of IA already covers it.

## 8. Shape fit — strong

DESIGN.md body order matches canonical lock: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. EXPERIENCE required defaults present: Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows. Applicable extras present: Inspiration & Anti-patterns (rejects in memlog/PRD), Responsive & Platform (Cashier multi-surface + breakpoints). No invented sections that fail to earn place. Matches shadcn example shape (delta DESIGN + behavioral EXPERIENCE).

### Findings

- **[low]** EXPERIENCE lede says "Fast-path draft" while shape is otherwise complete — fine for draft, slightly noisy for consumers (EXPERIENCE.md title block). *Fix:* Drop "Fast-path draft" when status → final.

## Mechanical notes

- Sources frontmatter (relative `_bmad-output/...` paths) resolve from repo root for all three cited artifacts.
- `{rounded.sm/md/lg}` is not a valid single token path (see §2).
- State Patterns markdown table: header column count ≠ cold-load row column count (see §4).
- Component aliases across spines: Receipt confirm ↔ Receipt gate; Pay / complete CTA ↔ Checkout pay; Cart Panel vs Cart line (behavior split).
- `sync-ok` color defined and described in Colors prose; no matching `components` entry.
- Visual dirs: `imports/` empty; `mockups/` / `wireframes/` not created — expected pre-mock; do not treat as orphaned links.
- No Mermaid in either spine.
- Frontmatter extras beyond design.md core (`status`, `created`, `updated`, `sources`) are consistent across the pair and useful for consumers.
- Indonesian-first Voice table is extractable; no conflicting EN-primary chrome elsewhere.
- Spines-win-on-conflict stated once in EXPERIENCE lede (good); DESIGN does not contradict.
