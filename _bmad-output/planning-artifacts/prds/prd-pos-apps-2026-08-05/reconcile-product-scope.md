# Reconcile: product-scope.md ↔ PRD

**Input:** `docs/01-business/product-scope.md`  
**PRD:** `prd.md` (prd-pos-apps-2026-08-05)  
**Date:** 2026-08-05

---

## Gaps (input vs PRD)

### 1. Vertical / pilot niche
- **Input:** Retail-first; one store; niche open (boutique, warung, general retail).
- **PRD:** Coffee-shop / cafe Phase 1 pilot; explicitly notes vision/scope said retail-first and may need sync.
- **Gap:** Product-scope boundary and open decisions still say retail-first; PRD has already reframed the pilot.

### 2. Same-day void + manager PIN
- **Input:** In Phase 1 — same-day void with logged manager PIN override.
- **PRD:** Manager void/override PIN deferred; out of §4.1 and MVP (§6.2); not in UJ-1–3.
- **Gap:** Capability listed as Phase 1 IN in product-scope is explicitly out of PRD MVP.

### 3. Hold / park sale
- **Input:** Cart, checkout, **hold/park sale** in Capabilities IN.
- **PRD:** No FR or journey for hold/park; Instant Checkout path is select → cart → checkout → pay → receipt only.
- **Gap:** Hold/park is scoped IN upstream but absent from PRD features.

### 4. Auth model shape
- **Input:** Authentication: cashier / manager; online login; offline session continuation.
- **PRD:** Two-step **Account Login** + **6-digit POS PIN**; offline unlock is PIN after prior Account Login (FR-1–FR-5).
- **Gap:** Product-scope does not specify POS PIN gate or the Account Login → POS PIN sequence the PRD requires.

### 5. Receipt reprint / digital + Admin CSV / conflict report
- **Input:** Receipt print **and/or digital** + **reprint by sale id**; Admin **sales list/CSV**; Offline Mode **conflict report**.
- **PRD:** Print Receipt only (FR-10–FR-12); sales list/totals not CSV (FR-31); CRDT/conflict perfection out of scope — no conflict-report FR.
- **Gap:** Several thin-Admin / Offline acceptance details in product-scope are not represented (or are narrowed) in the PRD.
