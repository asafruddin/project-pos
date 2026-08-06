# Addendum — POS Apps Phase 1 PRD

Companion to `prd.md`. Holds deferred depth and intentional cuts from input reconciliation. Not a substitute for the PRD.

## Intentional overrides of `docs/01-business/`

| Input said | PRD Phase 1 says | Why |
|------------|------------------|-----|
| Retail-first | Coffee-shop pilot | User coaching decision |
| Same-day void + manager PIN | Deferred (out of MVP) | Not in UJ-1–3 |
| Hold/park sale | Deferred | Not narrated |
| 1-week live pilot preference gate | Demo/portfolio gates (SM-1–3) | User: OK without SaaS growth; demo primary |
| CSV export | List + totals on Dashboard | Thin admin |
| Keyboard/scanner first-class | Not required for Phase 1 demo | Coffee-shop tap UI primary |

## Deferred to later phases / follow-up tickets

- Manager void / price override with PIN + log
- Hold / park Sale
- Receipt reprint by Sale id; digital receipt URL
- Sync conflict UI beyond retry + indicator
- Day-close cash-drawer physical match ritual as hard gate
- Accountant CSV export
- Drink size/modifier matrix
- Native shell (only if PWA fails print/offline on chosen device)

## Mechanism notes (for architecture — not PRD FRs)

- Local Database + Sync upload queue is the Offline Mode mechanism; CRDT out of scope
- Receipt may be browser print or ESC/POS once hardware matrix is chosen (Open Question in PRD)
