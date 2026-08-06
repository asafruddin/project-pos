# Validation Report — POS Apps

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/EXPERIENCE.md`
- **Run at:** 2026-08-06T09:28:00+07:00

## Overall verdict

The spine pair is an **adequate** downstream contract for Sale/Sync/offline behavior and shadcn brand-layer structure: UJ-1–3 map to Key Flows, tokens largely resolve, and Offline & Sync honesty largely passes. Extra lenses shift the picture: **accessibility is not yet AA-claimable** (contrast + POS PIN 3.3.8), and **i18n is not implementable as ID-first** (EN chrome in IA/Flows; missing Day Close acknowledge strings). Visual refs are thin (expected pre-mock). Resolve critical/high before treating spines as `final`.

## Category verdicts

- Flow coverage — adequate
- Token completeness — adequate
- Component coverage — adequate
- State coverage — adequate
- Visual reference coverage — thin
- Bloat & overspecification — strong
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

### Critical (6)

**[Accessibility]** Sync OK green has no foreground; white-on-green ~3.3:1 fails AA  
Fix: Add `sync-ok-foreground` (≥4.5:1); ban white labels on Sync OK chips.

**[Accessibility]** Amber as text-only status fails (~3.2:1); “checked for contrast” overstated  
Fix: Contrast matrix; amber only as chip fill + dark fg.

**[Accessibility]** POS PIN vs WCAG 2.2 3.3.8 (paste/autofill / cognitive test)  
Fix: Allow paste into masked input or document conformant alternative/exception.

**[i18n]** Key Flows/IA teach EN chrome despite ID-first  
Fix: ID primary in Flows/IA; EN secondary in parentheses.

**[i18n]** Glossary drift (`PIN kasir`/`Tutup hari` vs `POS PIN`/`Day Close`)  
Fix: Canonical glossary table; ID for UI copy.

**[i18n]** Day Close acknowledge has no ID/EN microcopy  
Fix: Lock block + acknowledge + confirm strings.

### High (n)

**[Rubric / Token]** No contrast targets for load-bearing brand pairs (DESIGN Colors / EXPERIENCE A11y Floor).

**[Accessibility]** 48 vs 56 tap floor inconsistency; Offline `aria-live`; Cart Sheet focus/dismiss; Receipt dialog focus; PIN keyboard semantics.

**[i18n]** Missing ID/EN for empty/error/Sync states; money locale (IDR) unspecified.

**[Offline]** (none high — four medium copy locks)

### Medium / Low

See `review-rubric.md`, `review-accessibility.md`, `review-offline-sync.md`, `review-i18n.md` for full lists (component name drift, dark status tokens, retrying Sync copy, Dashboard lag honesty, etc.).

## Reviewer files

- `review-rubric.md`
- `review-accessibility.md`
- `review-offline-sync.md`
- `review-i18n.md`
