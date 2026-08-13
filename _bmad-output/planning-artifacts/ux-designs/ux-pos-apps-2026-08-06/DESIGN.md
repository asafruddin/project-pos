---
name: POS Apps
description: "Warm, trustworthy coffee-shop POS — Instant Checkout + Offline Mode, then operations on Dashboard. shadcn/ui brand-layer delta only."
status: final
created: 2026-08-06
updated: 2026-08-13
sources:
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
colors:
  # Brand overrides on shadcn. Unlisted tokens inherit shadcn (background, foreground, muted, border, input, ring, destructive, card, popover).
  primary: '#1D4ED8'
  primary-foreground: '#FFFFFF'
  accent: '#D97706'
  accent-foreground: '#1A1208'
  primary-dark: '#60A5FA'
  primary-foreground-dark: '#0B1220'
  accent-dark: '#FBBF24'
  accent-foreground-dark: '#1A1208'
  sync-waiting: '#D97706'
  sync-ok: '#16A34A'
  offline-banner: '#1E3A8A'
typography:
  # Body/label inherit shadcn (Geist Sans). Display is brand-layer only — warm, restrained.
  display:
    fontFamily: 'Source Serif 4'
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  display-sm:
    fontFamily: 'Source Serif 4'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.25'
  cashier-price:
    fontFamily: 'Geist Sans'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
    note: 'Tabular figures for money; minor units formatted in UI'
rounded:
  # Slightly softer than sharp-tool defaults — warm consumer SaaS, still a tool.
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  # shadcn/Tailwind 4-based scale inherited; cashier density overrides:
  tap-min: 48px
  tap-comfortable: 56px
  cart-gutter: 16px
  menu-tile-gap: 12px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    minHeight: '{spacing.tap-min}'
  button-cashier-pay:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    minHeight: '{spacing.tap-comfortable}'
  product-tile:
    background: 'inherited card'
    radius: '{rounded.md}'
    minHeight: '{spacing.tap-comfortable}'
  sync-chip-waiting:
    background: '{colors.sync-waiting}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.sm}'
  offline-banner:
    background: '{colors.offline-banner}'
    foreground: '#F8FAFC'
---

## Brand & Style

Product display name is **POS Apps**. Brand feel is **warm** (human, cafe-adjacent trust) expressed through softer radii and amber attention accents on a POS-trust blue primary, while staying **tool-clear** at the counter — Dewi must never hunt for the next tap.

POS Apps is a coffee-shop Point of Sale for consumer SaaS: Instant Checkout and Offline Mode as co-equal pillars.

Visual identity inherits **shadcn/ui** on Next.js + Tailwind. This DESIGN.md specifies only the brand-layer delta: a POS-trustworthy **blue** primary, a **warm amber** accent for “live / waiting / attention,” softer radii for approachability, and oversized tap targets on Cashier. Unlisted shadcn tokens stay default.

Native-feel web/PWA (per PRD): chrome is quiet; status (offline, Sync) is always legible without drama.

## Colors

- **Primary Blue (`#1D4ED8` light / `#60A5FA` dark)** — brand and primary actions: Login, POS PIN confirm, Checkout pay, Day Close confirm, Dashboard primary CTAs. Chosen as a clear POS-trust blue; not decorative gradients.
- **Warm Accent Amber (`#D97706` light / `#FBBF24` dark)** — “needs attention / in motion”: Sync waiting-to-upload chip, soft warnings that are not errors, focus on the live cart total. **Not** used for destructive or for complete-Sale success.
- **Sync OK green (`#16A34A`)** — Sync caught up only. Do not reuse for Sale complete (complete is structural, not a color party).
- **Offline banner navy (`#1E3A8A`)** — Offline Mode strip on Cashier; calm, not alarm-red.
- **All other tokens** inherit shadcn (including `destructive` for true errors: wrong PIN, Receipt failure, blocked Day Close).

Avoid: purple gradients, more than two brand hues, using amber to mean “Sale incomplete,” celebrating Sync with confetti.

## Typography

Body / labels / UI chrome inherit shadcn Geist Sans. Brand overrides:

- **`display` / `display-sm` (Source Serif 4)** — empty states, Day Close report title, Dashboard welcome. Sparse punctuation, not body copy.
- **`cashier-price`** — Cart Panel and totals; tabular numbers; always formatted from integer minor units.

Indonesian is the default UI language; English is secondary (see EXPERIENCE.md). Type must remain legible at arm’s length on tablet.

## Layout & Spacing

- **Cashier (multi-surface):** Default composition is **Cashier Menu (main) + Cart Panel (right)** on tablet/desktop widths. On narrow phone, Cart Panel becomes a persistent bottom sheet / full-height sheet — same IA, stacked. Breakpoint for stack: `< md` (768px).
- **Dashboard (desktop browser):** Sidebar + content; comfortable mouse density; still `minHeight` ≥ `{spacing.tap-min}` on primary actions.
- Tap floor: interactive Cashier controls ≥ `{spacing.tap-min}` (48px); pay / PIN pad keys ≥ `{spacing.tap-comfortable}` (56px).
- Spacing scale otherwise inherits Tailwind/shadcn.

## Elevation & Depth

Inherit shadcn shadows. Cart Panel may use a raised surface (`card`) against Menu; no multi-layer glow. Offline/Sync use color chips and banners, not heavy elevation.

## Shapes

`{rounded.sm/md/lg}` = 8 / 12 / 16 — warmer than sharp admin tools, still rectangular (not pill-everything). PIN pad keys use `{rounded.md}`. Status chips may use `{rounded.sm}`; avoid `rounded-full` except Sync/status pills.

## Components

shadcn as-is unless listed: `Button`, `Input`, `Dialog`, `Sheet`, `Toast`, `Badge`, `Separator`, `Tabs`, `Table` (Dashboard), `Skeleton`.

Brand-layer / POS-specific:

| Component | Visual rule |
|---|---|
| **Button primary** | `{colors.primary}` / `{colors.primary-foreground}`; Cashier min height `{spacing.tap-min}` |
| **Pay / complete CTA** | `{components.button-cashier-pay}` — tallest primary on Checkout |
| **Product tile** | Large tap target; name + price; no dense metadata |
| **Cart Panel** | Right column (or sheet on phone); line price via `{typography.cashier-price}` |
| **PIN pad** | 3×4 grid; keys ≥ `{spacing.tap-comfortable}` |
| **Sync chip (waiting)** | `{colors.sync-waiting}` — label must not imply Sale incomplete |
| **Offline banner** | `{colors.offline-banner}` top of Cashier when offline |
| **Receipt confirm** | Dialog/sheet; primary = confirm Receipt; secondary = retry print / cancel Sale |

→ Visual refs: `mockups/cashier-sell.html`, `mockups/pos-pin.html`, `mockups/offline-sync.html`, `mockups/day-close.html`. Spines win on conflict.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Inherit shadcn for everything outside the brand layer | Restyle every shadcn component “for brand” |
| Keep Cashier Menu + Cart Panel as one sell composition | Turn Instant Checkout into a multi-page wizard |
| Use amber only for attention / Sync waiting | Use amber to mean Sale failed or incomplete |
| Big tap targets on Cashier | Hover-only affordances on phone |
| Quiet offline banner + clear Sync chip | Alarm UX that makes offline feel like an error Sale |
| Light + dark via system default + manual override | Force dark-only “AI SaaS” aesthetic |
| Indonesian-first UI strings | English-only chrome with ID as afterthought |
