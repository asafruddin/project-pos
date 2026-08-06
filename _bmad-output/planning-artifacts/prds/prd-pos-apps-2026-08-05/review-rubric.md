# PRD Quality Review — POS Apps — Phase 1

## Overall verdict
Phase 1 thesis, Non-Goals, counter-metrics, and Dewi’s journeys hold together: Instant Checkout + Offline Mode for a single coffee shop, judged by demo credibility rather than SaaS growth. What is at risk is engineering done-ness — most FRs after auth lack testable consequences — and the unresolved Sale-vs-Receipt-print / Stock coupling that UJ-1 and FR-11–FR-12 leave ambiguous. Direction is decision-ready; story-ready it is not yet.

## Decision-readiness — adequate
Trade-offs are named as decisions, not smoothed into “balance.” Phase 1 success non-goal (“SaaS subscription / MRR growth”), coffee-shop pilot vs earlier retail-first vision (§0), and co-equal Offline Mode bar (§1) are explicit. §5 Non-Goals and per-feature Out of Scope lists show what was given up. Open Questions (§9) are genuinely open (printer matrix, catalog shape, tax, vision sync).

Gaps: real tensions around print failure and Day Close Sync warn are stated as requirements without `[NOTE FOR PM]` callouts naming the product choice (soft warn vs hard gate; Sale complete vs incomplete when print fails). A decision-maker can greenlight the bet; an implementer pushing back on Sale/Receipt atomicity will find the objection only half-acknowledged.

### Findings
- **high** Sale state on Receipt print failure unspecified (§4.2 FR-11–FR-12; UJ-1 edge) — UJ-1 says “If Receipt print fails, Stock must not silently update as if the Sale fully completed,” and FR-12 repeats that Stock must not silently update, but neither defines whether the Sale is completed, voided, or held. *Fix:* State the intended Sale lifecycle on print failure (e.g. Sale incomplete until print succeeds vs Sale success with Stock deferred) and what the cashier sees next.
- **medium** Day Close Sync warn semantics (§4.4 FR-24; UJ-3) — “app warns before Day Close can complete” + `[ASSUMPTION: warn-before-close]` does not say soft allow-with-ack vs hard block until Sync. *Fix:* Choose one and add a testable consequence (e.g. confirm dialog allows proceed / Day Close blocked while Sync pending).
- **low** Vision/PRD pilot drift deferred without PM note (§0; §9 Q4) — “Earlier vision docs said retail-first; this PRD’s Phase 1 pilot case is coffee shop” is honest but only an Open Question. *Fix:* Add `[NOTE FOR PM]` that greenlighting this PRD implies either syncing vision.md or accepting intentional Phase 1 divergence.

## Substance over theater — strong
Content earns its keep. Jobs To Be Done are three lean roles, not a persona parade; Dewi carries all UJs. Vision (§1) is category-specific — “website that feels like a native app,” Instant Checkout + Offline Mode, single shop, portfolio/demo stakes — and would not survive a swap into a generic multi-branch SaaS POS PRD. Latency NFRs are product-specific thresholds, not “must be scalable.” Counter-metrics SM-C1/SM-C2 actively forbid theater metrics. No separate “innovation” section inventing novelty.

### Findings
*(none — dimension is strong)*

## Strategic coherence — strong
Clear thesis: *“a barista-cashier can sell fast, including when the network dies, and close the day with a clear report — not we already have paying SaaS tenants”* (§1). Feature spine follows that arc: auth gate → Instant Checkout → Offline Mode → Day Close → thin Dashboard. Success Metrics SM-1–SM-3 validate the journeys, not activity vanity; SM-C1/SM-C2 name what not to optimize. MVP kind matches: problem-solving / experience demo for one shop, not platform or revenue MVP. FR-1–FR-32 map cleanly onto the thesis pillars.

### Findings
- **medium** “Real money” pilot vs payment assumption (§1 vs FR-9) — Vision allows a pilot that puts “real money through the sell loop,” while FR-9 assumes “cash and/or simple ‘paid’ record; live card gateway out of Phase 1.” Credibility for a live coffee-shop pilot may need cash-drawer discipline or an explicit “demo paid” path. *Fix:* Clarify what “real money” means for Phase 1 (cash-only pilot OK) or demote live-pilot language to optional stretch.

## Done-ness clarity — thin
Auth FRs (FR-1–FR-5) model the right pattern: short statement + **Consequences (testable)**. From FR-6 onward, most FRs are capability one-liners without consequences. Downstream story creation will invent acceptance criteria. Soft language remains: “clear error” (FR-3), “Authorized user” (FR-28), “must feel native” (§8). FR-21’s offline drill is the strongest acceptance anchor in the doc; Instant Checkout and Dashboard do not match that bar.

### Findings
- **critical** Majority of FRs lack testable consequences (§4.2–§4.5 FR-6–FR-32) — Only §4.1 systematically lists consequences. FR-6–FR-10, FR-14–FR-20, FR-22–FR-27, FR-28–FR-32 are statements like “Cashier can browse/select products” without verifiable conditions. *Fix:* Add at least one testable consequence per FR (pass/fail observable), matching FR-1–FR-5 style.
- **high** Print-failure / Stock / Sale coupling incomplete (§4.2 FR-11–FR-12) — “successful Sale with successful Receipt print” ties Stock to print success without defining cashier recovery, retry, or partial failure. *Fix:* Specify recovery path and Stock/Sale invariants as bullet consequences under FR-11 and FR-12.
- **medium** Unbounded adjectives in NFRs and auth (§8; FR-3) — “must feel native,” “clear error,” and Hardware “target demo device(s)” with “printer matrix TBD” leave acceptance subjective. *Fix:* Bound “native-feel” via SM-4 latency ASSUMPTIONs as the acceptance proxy; require error copy presence; list at least one accepted printer or mark print as demo-blocker Open Question until chosen.
- **medium** Tax / price semantics unset (§9 Q3; FR-7, FR-9) — Open Question on “Tax inclusive/exclusive for coffee-shop prices in Indonesia” with no interim ASSUMPTION on Cart Panel display or Receipt totals. *Fix:* Tag an `[ASSUMPTION]` for Phase 1 (e.g. tax-inclusive display prices) or block Receipt/FR-9 until answered.

## Scope honesty — strong
Omissions do real work. §5 Non-Goals, §6.2 Out of Scope, and feature-level Out of Scope (SSO, CRDT, KDS, card gateway, analytics) prevent silent assumption of platform breadth. `[ASSUMPTION]` tags appear inline and round-trip to §10. Open Questions are not rhetorical. De-scoping of modifiers, voids, and multi-cashier conflict is explicit. For draft / demo-portfolio stakes, open-item density (4 OQs + ~10 assumptions) is appropriate; for a live-money green light it would be a soft blocker until printer, tax, and payment shape close.

### Findings
- **low** Catalog-shape assumption duplicated as Open Question (§6.2 vs §9 Q2) — `[ASSUMPTION: simple product list is enough for Phase 1 demo]` and Q2 both ask flat vs sizes/modifiers. *Fix:* Keep one as assumption for MVP and one as confirm-or-revise Open Question, and cross-link so they do not read as conflicting.

## Downstream usability — adequate
Glossary (§3) anchors domain nouns used across UJs and FRs; FR-1–FR-32, UJ-1–UJ-3, SM-1–SM-5 / SM-C1–SM-C2 are contiguous and unique. Document purpose states chain-top intent (UX → architecture → stories). UJs name Dewi as protagonist with entry/climax/resolution. Weak spots for extraction: Dashboard FRs (FR-28–FR-32) have no manager UJ; Stock’s Glossary gloss (“after Sync (or online Sale)”) does not mention Receipt-print gating that FR-11 adds; many FRs cannot be lifted into stories without inventing ACs.

### Findings
- **medium** No named journey for Dashboard / catalog role (§2.3 vs §4.5) — Manager JTBD exist (“See Stock and Sales on Dashboard”) but UJs are cashier-only. FR-28–FR-32 will force UX/stories to invent the protagonist path. *Fix:* Add UJ-4 for owner/manager (or builder) creating a product and verifying Stock after a Sale.
- **medium** Glossary Stock vs FR-11 Receipt gate (§3 Stock; FR-11) — Glossary: “Product quantity shown/updated on Dashboard after Sync (or online Sale).” FR-11 requires successful Receipt print before Stock update online. *Fix:* Update Stock (or Sale) Glossary entry to include the print-success condition so sections extract consistently.
- **low** Assumption label inconsistency (inline tags) — Mix of bare `[ASSUMPTION]`, `[ASSUMPTION: warn-before-close]`, and index paraphrases. Roundtrip mostly works; labels would ease grep. *Fix:* Prefer labeled forms matching §10 keys.

## Shape fit — strong
Shape matches product and stakes: meaningful cashier UX + light B2B back-office → named UJs are load-bearing and present; capability FRs cover Instant Checkout / Offline / Day Close; SMs are journey/acceptance-oriented rather than SaaS growth. Not over-formalized for a single-shop demo Phase 1; not under-formalized (UJs and Offline drill exist). Coffee-shop reframing is coherent inside the PRD; upstream vision retail-first mismatch is acknowledged rather than papered over.

### Findings
*(none material — vision sync already covered under Decision-readiness)*

## Mechanical notes
- **ID continuity:** FR-1–FR-32, UJ-1–UJ-3, SM-1–SM-5, SM-C1–SM-C2 — contiguous, no duplicates found.
- **Assumptions Index roundtrip:** Inline assumptions map to §10 entries (FR-5, FR-9, FR-13, §4.2 NFR, FR-20, FR-24, FR-31, FR-32, §6.2, §8). UJ-2 Sync-indicator assumption aligns with FR-20; UJ-3 warn-before-close with FR-24.
- **Glossary drift:** Minor — “Cashier” role vs persona “Dewi”; “Sync’d” vs “Sync”; Stock definition incomplete vs FR-11 (see Downstream). Domain nouns otherwise stable.
- **HTML entities:** §4.2 NFR and §10 use `&lt;` instead of `<` — cosmetic in source Markdown.
- **Required sections for stakes:** Vision, users/UJs, Glossary, FRs, Non-Goals, MVP, SMs (+ counters), NFRs, Open Questions, Assumptions Index — present. No `addendum.md`.
- **UJ protagonists:** UJ-1–UJ-3 all name Dewi with context inline.
