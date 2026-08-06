# Accessibility Review — POS Apps

Ad-hoc review of `DESIGN.md` + `EXPERIENCE.md` (ux-pos-apps-2026-08-06) against WCAG 2.2 AA claims and Cashier-critical surfaces. Spec-only; no implementation audited.

## Overall verdict

**Conditionally not ready to claim WCAG 2.2 AA.** The Accessibility Floor is directionally right (text+`aria-live` for Sync, ≥48px taps, focus rings, keyboard PIN/Pay, no swipe-only Checkout), but several brand tokens and interaction contracts are underspecified or contrast-fail if implemented the obvious way. Sync OK green has no foreground; amber fails as text-only status; POS PIN likely collides with 3.3.8 Accessible Authentication; Cart Sheet / Receipt focus and phone dismiss behavior are hand-waved. Fix the critical/high items before treating AA as a Phase 1 acceptance claim.

## Findings

- **[critical]** Sync OK green (`#16A34A`) has **no foreground token**. White-on-green is **~3.3:1** (fails AA normal text / typical chip label). Dark-on-green is ~5.6:1 and would pass. Fix: Add `sync-ok-foreground` (use `#1A1208` or equivalent ≥4.5:1) and forbid white labels on Sync OK chips.

- **[critical]** Claim “brand blue/amber checked for contrast” is **overstated**. Amber `#D97706` as **text on white** (or white text on amber fill) is **~3.2:1** — fails 1.4.3 for normal text. Chip fill + `#1A1208` label (~5.8:1) passes; dark accent `#FBBF24` + dark fg (~11:1) and primary pairs pass as specified. Fix: Document allowed pairings only (chip fill + dark fg); ban amber/green as lone status text color; add a one-line contrast matrix for light+dark brand tokens.

- **[critical]** POS PIN pad vs **WCAG 2.2 AA 3.3.8 Accessible Authentication**. A memorized 6-digit PIN is a cognitive function test; custom on-screen pads commonly block paste, password managers, and OS autofill. Spine says keyboard-operable but not paste/autofill/alternative. Fix: Allow paste into a real (visually masked) input, or document an AA-conformant alternative (e.g. account session already authenticated + device unlock path) and state which exception applies; never trap digits only in non-text buttons without a text field fallback.

- **[high]** Accessibility Floor cites targets **≥48px** only; DESIGN requires **56px** for Pay / PIN keys / product tiles. Steppers are “not tiny” with **no numeric floor**. Dashboard “primary actions” ≥48px leaves icon-only / secondary controls unconstrained (2.5.8 is 24px minimum, but brand promise is 48). Fix: Unify floor in EXPERIENCE to match DESIGN (48 default / 56 Pay·PIN·tiles); explicitly set Cart qty ± / remove ≥48px; call out Dashboard icon buttons ≥24px AA minimum with visible name.

- **[high]** Sync: text + `aria-live="polite"` is good; **Offline banner appear/clear** has no live-region contract. Color chips without guaranteed non-color cue for **synced / waiting / retrying** in DESIGN (only waiting chip styled; OK green unlabeled). Fix: Require visible text (or icon+text) for every Sync state; `aria-live` polite for Offline banner show/hide and Sync state changes; ensure chip accessible name matches microcopy (“Menunggu unggah” / synced / retrying)—never color alone.

- **[high]** Cart Sheet on phone (`< md`): no focus trap, initial focus, restore focus, `aria-modal`, or dismiss model. Ban on swipe-only **Checkout** does not ban swipe-dismiss of Cart that hides Pay / line edits. Sheet can obscure focused Menu controls (2.4.11 Focus Not Obscured). Fix: Specify Sheet as modal while open (or persistent non-modal with always-visible Pay affordance); Esc/explicit close control; focus moves into sheet on open and returns to trigger; no swipe-only dismiss for cart with ≥1 line during Checkout path; ensure focused control isn’t covered by sheet chrome.

- **[high]** Receipt Dialog: climax of Instant Checkout; failure → retry/cancel. No focus move to dialog, labelled title, `role="alertdialog"` on failure, or announcement that Sale is **complete** vs **incomplete**. Print path depends on browser print UI (often weak a11y). Fix: On open, focus primary confirm; failure uses assertive live or alertdialog; success announces “Struk berhasil — penjualan selesai” (or EN); keep on-screen confirm as equal accessible path to print; return focus sensibly after close.

- **[high]** PIN pad keyboard: “operable by keyboard” lacks grid semantics (roving tabindex / arrow keys), digit key names for AT, wrong-PIN error association (`aria-describedby` / `aria-live`), and focus order into Confirm. Fix: Spec keyboard map (0–9, Backspace, Enter=confirm), SR-readable key labels, error in assertive live region tied to the PIN field, focus ring on keys ≥3:1 against key face (2.4.13 intent).

- **[medium]** Focus rings: “Focus visible (`ring`)” only. Primary blue buttons + default shadcn ring often **fail focus appearance** against adjacent blue; dark theme untested in spine. Fix: Define focus token contrast ≥3:1 against both light and dark surfaces and against primary/accent fills (offset ring or contrasting dual-color ring).

- **[medium]** Language switch: “does not rely on color alone” is necessary but insufficient. No `lang` on `<html>`, no per-string language tagging, no announcement of locale change, no guarantee control has a text name (flag-only is a trap). Indonesian-first microcopy can break if EN strings ship first. Fix: Require `lang`/`dir` update on switch; control labeled with language **name** (Bahasa Indonesia / English), not color or flag alone; optional polite live “Bahasa diubah” / “Language changed”; document string completeness for ID default.

- **[medium]** Dark mode: primary/accent dark pairs are fine; **offline navy, sync-waiting, sync-ok lack dark-theme variants**. Reusing light navy banner on dark UI is usually OK (own background); reusing `#D97706` / `#16A34A` as **foreground** on light cards in dark mode needs explicit pairs. Fix: Add dark Sync/Offline tokens or state “same chip fills + dark foregrounds in both themes” with verified ratios.

- **[medium]** WCAG **2.2** AA named, but spines ignore several 2.2 AA additions beyond target size: **2.4.11 Focus Not Obscured** (sticky offline banner + Cart sheet + Dialog stack), **3.3.7 Redundant Entry** (re-login after Day Close—OK if intentional), dragging if any qty scrub exists. Fix: Explicitly address focus not obscured under Offline banner + Sheet + Receipt; ban drag-only qty; note 3.3.8 as above.

- **[low]** No reduced-motion, skip link, or landmark/`h1` structure for Cashier vs Dashboard. Touch-first is strong; SR landmark story is absent. Fix: `prefers-reduced-motion` for any motion; one `main` + labeled complementary for Cart; skip to Menu/Cart on laptop Cashier.

- **[low]** Status “never only color” is stated for Sync/Offline and language, but **Sale complete** is “structural, not a color party”—good—yet success may still be only a visual layout change without a status text node. Fix: Persist a textual Sale-complete confirmation in the Receipt success state (already in microcopy)—bind it to an accessible name/live announcement.

### Contrast quick-check (approximate)

| Pair | Ratio | AA normal |
|---|---|---|
| `#FFFFFF` on `#1D4ED8` | ~6.7:1 | Pass |
| `#0B1220` on `#60A5FA` | ~7.4:1 | Pass |
| `#1A1208` on `#D97706` | ~5.8:1 | Pass |
| `#D97706` on `#FFFFFF` (text-only) | ~3.2:1 | **Fail** |
| `#FFFFFF` on `#16A34A` | ~3.3:1 | **Fail** |
| `#1A1208` on `#16A34A` | ~5.6:1 | Pass |
| `#F8FAFC` on `#1E3A8A` | ~9.9:1 | Pass |
| `#1A1208` on `#FBBF24` | ~11.1:1 | Pass |

### What already holds up

- Visible Sync/Offline **copy** in microcopy tables (“Menunggu unggah”, “Mode offline”) beats color-only POS anti-patterns.
- Tap intent 48/56 and ban on hover-only phone affordances match cashier reality.
- One-level modal stack reduces focus chaos.
- On-screen Receipt confirm as peer to print is the right accessibility escape hatch.
- Primary blue and offline banner pairs, and dark primary/accent button pairs, are contrast-sound when used as specified.
