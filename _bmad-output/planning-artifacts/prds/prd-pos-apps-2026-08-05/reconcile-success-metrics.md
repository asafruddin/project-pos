# Reconcile: success-metrics.md ↔ PRD

**Input:** `docs/01-business/success-metrics.md`  
**PRD:** `prd.md` (§7 Success Metrics, related FRs/NFRs)  
**Date:** 2026-08-05

## Gaps (input present; PRD missing or weaker)

1. **Day-close cash integrity (P1-08)** — Input gates Phase 1 on cash / recorded payments matching local + synced sales. PRD SM-3 only requires Today’s Sales Report + return to Account Login; no match/reconciliation gate.

2. **Cashier preference after 1 week (P1-09)** — Input requires cashier prefers system to notebook after one week (interview/vote). PRD has no preference gate; success is demo/portfolio (SM-1, SM-5).

3. **Pilot duration ≥1 week (P1-11)** — Input requires 1 store · ≥1 week real use as a hard gate. PRD treats live pilot as optional; SM-5 is presenter-ready demo of UJ-1/UJ-2.

4. **Sync visibility as Phase 1 gate (P1-06)** — Input requires connectivity + pending sync count always understandable as a must-pass gate. PRD has FR-20 (indicator assumption) but no SM covering sync UX acceptance.

5. **Measurement plan & leading indicators** — Input defines device harness, offline drill script, day-close sheet, pilot diary, hardware checklist, plus weekly leading indicators (outbox depth, bypass→0, conflict rate). PRD §7 lists SM-1–SM-5 / counters only; no measurement plan or leading-indicator set.
