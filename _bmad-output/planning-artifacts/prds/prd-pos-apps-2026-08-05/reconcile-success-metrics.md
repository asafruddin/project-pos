# Reconcile — success-metrics.md

**Input:** `docs/01-business/success-metrics.md` (v1.1)  
**Against:** `prd.md` §7 + related FRs/NFRs, `addendum.md`  
**Date:** 2026-08-13  
**Rule:** gaps only — do not rewrite the PRD.

## Covered (keep short)

- Zero lost Sales + offline sell loop + reconnect Sync (P1-01/02/07) → SM-2, FR-14–FR-21.
- Local latency targets (P1-03–05) → §4.2 NFR, SM-4.
- Sync pending count (P1-06 mechanics) → FR-20.
- Day Close report + Sync block (part of P1-08) → SM-3, FR-23–FR-24.
- Phase 2 P0 ops: ledger, opname, PO→receipt, Return→inventory, Shift difference, Admin+Cashier images, Cloudinary isolation, no orphans (P2-02–10) → SM-6–SM-10, SM-C4/C5.
- Phase 2 P1 when 2D ships: Promotions, Loyalty, reports, RBAC, multi-Store (P2-12–16) → SM-12–SM-14; not 2A blockers (SM-C2, §9).
- Explicit non-gates: Lighthouse, CRDT, SaaS/MRR, warehouse/KDS/API, analytics-as-Phase-1 — §5, SM-C1–C3, addendum.
- Offline drill re-run after media (P2-01 subset) → FR-21, SM-2, SM-C4.

## Gaps (2-5, the important ones)

### 1. Live-week + cashier preference (P1-09, P1-11) replaced by demo/portfolio

- **Input:** North-star is one store running a **full week** including offline, with **zero lost Sales**, matching day-close cash, and **cashiers preferring the system to notebook/spreadsheet**. Hard gates: preference after 1 week (P1-09); **1 store · ≥1 week real use** (P1-11). P1-01 is 0 lost Sales during **pilot week and** drills.
- **PRD+addendum:** SM-1–SM-3 + SM-5 are UJ/demo/portfolio. Addendum override: “1-week live pilot preference gate → Phase 1 demo/portfolio gates (SM-1–3)” with reason **“SaaS growth is not a Phase 1 gate.”** That reason is a distortion — the input already excludes SaaS/MRR; the week is a **cashier-trust / store-day** bar, not growth.
- **Why it matters:** “Phase 1 done” in the input is a live week cashiers choose over paper. In the PRD it is a presenter-ready drill. P2-01 (“all P1-01–11 still pass”) cannot mean what the input says if 09/11 were never gates.
- **Placement:** If the week/preference still stands → **PRD §7** as Phase 1 primary SMs (keep SM-C1 so SaaS stays a counter-metric). If demo-only is the real decision → **addendum** only, but **fix the rationale** (demo/portfolio vs live trust — not “because SaaS”).

### 2. Hardware path is a Phase 1 done-gate (P1-10), not an open question

- **Input:** Print **and/or** scanner path **proven** on chosen target devices — must-pass (P1-10); measurement item 5 is a hardware checklist.
- **PRD+addendum:** SM-1 may pass with browser print **or on-screen Receipt confirm** (OQ1, §8). Addendum only cuts “keyboard/scanner first-class” for tap UI — it does not record dropping **print/scanner as a success gate**.
- **Why it matters:** Input cannot call Phase 1 done without a proven device path. PRD can. Scanner is absent; print is optional.
- **Placement:** If hardware remains a go/no-go → **PRD §7** (and close or narrow OQ1). If demo fallback is intentional → **addendum** override row for P1-10 (print/scanner gate → on-screen OK), not only keyboard/scanner.

### 3. Day-close cash **match** (P1-08) vs report shown + cashier confirm

- **Input:** Cash / recorded payments **match** local + synced Sales for the day (P1-08); verify with an end-of-day **reconciliation checklist**. North-star: “matching day-close cash.”
- **PRD+addendum:** SM-3 = Today’s Sales Report + FR-24 (Sync). FR-23 **shows** cash summary; FR-26 is cashier **confirm**. No SM that drawer/recorded tenders **equal** POS totals. Phase 2 SM-9 **records** Shift difference and **allows** non-zero (FR-79) — different bar, later wave.
- **Why it matters:** Phase 1 “done” can ship with an inconsistent drawer as long as the cashier clicks confirm. Phase 2 difference-recorded must not be treated as having satisfied P1-08.
- **Placement:** Match-as-gate → **PRD §7** (tighten SM-3 / FR-23). Checklist / how-to-verify → **addendum** (pilot ops). Do not fold this into SM-9.

### 4. Measurement plan + leading indicators have no home

- **Input:** How to verify: device harness (P1-03–05), offline drill script, day-close sheet, **pilot diary**, hardware checklist; Phase 2 scripts for opname, PO, Return, Shift, Cloudinary isolation/orphans. Weekly **leading** (not all hard gates): outbox depth → 0 after reconnect; conflict/rejection rate with a clear action; voids logged not hidden; **POS vs notebook bypass → 0**; cashier onboard in minutes; unexplained opname variance investigated; open POs aging; returns without inventory decision = 0.
- **PRD+addendum:** FR consequences exist; no measurement plan; no leading-indicator set; no bypass→0 or onboard-time signal. Addendum defers “Sync conflict UI beyond retry + indicator” without the input’s **rejection-has-an-action** health signal.
- **Why it matters:** §7 SMs are pass/fail labels without the field method the input uses to call a phase done. Leading indicators are how build/pilot notices regression before a gate fails.
- **Placement:** Harness/scripts/checklists → **addendum** (QA/pilot). Bypass→0 and onboard-time, if they should stay visible to PM → short **PRD §7** “leading (not gates)” note; otherwise addendum.

## Qualitative dropped

- North-star voice: cashiers **prefer it to notebook**; the win is a **store week**, not a portfolio story.
- P1-06 “always **understandable**” via UX review + cashier observation (FR-20 only asserts count-match).
- Filter line: if a metric does not protect Instant Checkout speed, Offline Mode trust, or one-store day-close integrity, it is not a Phase 1 gate (PRD has counter-metrics, not this test).
- Weekly health-signal tone (outbox depth, bypass→0, onboard in minutes) — FRs cover some behaviors, not the “track weekly” frame.

## Not a gap

- Latency numbers, zero-lost-Sales **drill**, Phase 2 P0 ops SMs (SM-6–10), 2D SMs (SM-12–14), Cloudinary isolation / orphans.
- Long-term platform metrics (load &lt;2s, nav &lt;100ms, Lighthouse 95+, DX, multi-currency) — input says they are **not** Phase 1/2 launch criteria.
- TypeScript / generated clients — engineering hygiene, not a product SM.
- Customer history (P2-11): FR-70–72 + SM-11 exist; only **tier** is softer (PRD “secondary” vs input P0 table) — not worth a §7 rewrite by itself.
- Loyalty/Promotions/RBAC/multi-Store not blocking 2A — already explicit.
