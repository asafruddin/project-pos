---
name: POS Apps
status: final
created: 2026-08-06
updated: 2026-08-06
sources:
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
---

# POS Apps — Experience Spine

Behavioral contract for Cashier (multi-surface PWA) and Dashboard (desktop). Visual identity: `DESIGN.md` (shadcn + warm blue brand layer). **Spines win on conflict** with any mock or wireframe.

→ Composition references: `mockups/cashier-sell.html`, `mockups/pos-pin.html`, `mockups/offline-sync.html`, `mockups/day-close.html`.

## Foundation

- **Surfaces:** Cashier PWA (tablet / laptop / phone) + Dashboard desktop browser. Offline Mode and Local Database exist **only** on Cashier. Dashboard is online-only.
- **UI system:** shadcn/ui on Next.js + Tailwind. EXPERIENCE specifies behavioral delta only; visuals inherit `DESIGN.md` / shadcn defaults.
- **Theme:** Light and dark supported; **system preference is default**, with an in-app override under Settings / avatar menu on both apps.
- **Language:** **Indonesian first**, English second. Default locale ID; per-device preference to switch to EN under Settings. Microcopy tables below show ID primary / EN secondary.
- **Stakes:** Consumer SaaS (demo/portfolio Phase 1 still applies to scope depth — no multi-branch, KDS, etc.).
- **Density:** Big tap targets on Cashier (see `{spacing.tap-min}` / `{spacing.tap-comfortable}` in DESIGN.md).

## Information Architecture

| Surface | App | Reached from | Purpose |
|---|---|---|---|
| Account Login | Cashier, Dashboard | Cold start / after Day Close | Email/username + password |
| POS PIN | Cashier only | After Account Login | 6-digit unlock before sell |
| Cashier Menu | Cashier | After POS PIN | Browse/select products from Local Database |
| Cart Panel | Cashier | Always with Menu (right / sheet) | Lines, qty edit, prices, start Checkout |
| Checkout | Cashier | Cart with ≥1 item | Payment record |
| Receipt | Cashier | After payment | Print or on-screen confirm → Sale complete |
| Sync status | Cashier | Global chrome | Waiting to upload / synced — never re-labels complete Sale |
| Day Close | Cashier | From Cashier chrome | Totals, cash, Sync check → report → confirm |
| Today’s Sales Report | Cashier | Inside Day Close | Transactions, totals, prices |
| Products / Stock | Dashboard | After Login as catalog_admin | Create/edit name, price, Stock qty |
| Sales list / daily totals | Dashboard | After Login | List + totals (no charts) |
| Settings (theme/lang) | Both | Avatar / gear | Theme + language |

**Cashier layout rule:** Menu + right Cart Panel on `md+`; below `md`, Cart is a bottom/full sheet with the same behaviors. Modal stacks **one level** deep.

→ `mockups/cashier-sell.html` (Menu + Keranjang, synced chrome).

**Out of IA (Phase 1):** KDS, modifiers matrix, manager void PIN, offline Dashboard, analytics charts, multi-store switcher.

## Voice and Tone

Microcopy. Brand warmth lives in DESIGN.md; here = what the UI *says*.

| Do (ID) | EN secondary | Don't |
|---|---|---|
| "Masuk" | "Sign in" | "Let's crush today's sales! 🚀" |
| "PIN kasir" | "POS PIN" | "Security challenge" |
| "Keranjang" | "Cart" | "Basket / bag" inconsistency |
| "Bayar" | "Pay" | "Proceed to gateway" |
| "Struk berhasil — penjualan selesai." | "Receipt OK — Sale complete." | "Pending sync sale" for a complete Sale |
| "Menunggu unggah" | "Waiting to upload" | "Sale incomplete" / "Pending sale" for Sync wait |
| "Mode offline" | "Offline mode" | "Connection error" as the only framing when selling still works |
| "Tutup hari" | "Day Close" | Soft-dismiss unsynced without acknowledge |
| "PIN salah. Coba lagi." | "Wrong PIN. Try again." | Silent fail |

Tone: calm, short, cafe-counter pace. Errors name the next action (retry / cancel). Never log or display raw PIN/password.

## Component Patterns

Behavioral. Visuals: `DESIGN.md` / shadcn.

| Pattern | Where | Rules |
|---|---|---|
| Product tile | Cashier Menu | Tap adds/increments line in Cart Panel. Reads Local Database only. |
| Cart line | Cart Panel | Qty stepper + remove before Checkout. Price from catalog until Sale complete snapshots. |
| Checkout pay | Checkout | Enabled only with ≥1 cart line + payment recorded path. Does **not** mark Sale complete. |
| Receipt gate | Receipt | Complete only after print success **or** on-screen confirm. Failure → incomplete; Stock unchanged; retry or cancel. |
| PIN pad | POS PIN | 6 digits; wrong → clear error; Menu/Cart/Checkout blocked until success. Paste-capable masked field allowed for a11y (see mock). → `mockups/pos-pin.html` |
| Day Close blocker | Day Close | Cannot finish with unsynced complete Sales unless explicit acknowledge (audited). → `mockups/day-close.html` |
| Sync chip | Cashier chrome | States: synced / waiting to upload / retrying. Must not change Sale status label. → `mockups/offline-sync.html` (waiting) |
| Offline banner | Cashier | Visible while offline; sell loop remains available if Local DB + PIN material allow. → `mockups/offline-sync.html` |
| Product form | Dashboard | catalog_admin only; cashier role sees read-only or no edit controls. |
| Sales table | Dashboard | List + daily totals; empty state OK before first Sync. |

## State Patterns

| State | Treatment |
|---|---|
| Cold app load | Cashier / Dashboard | shadcn `Skeleton` matching Menu+Cart or table layout until Local DB / API resolves |
| Wrong Account Login / PIN | Inline error; no access to Cart/Checkout |
| Offline + PIN material present | POS PIN unlock works; full sell on Local DB |
| Offline + PIN material missing | Clear fail; do not fake unlock |
| Sale incomplete (Receipt fail) | Stay on Receipt; retry / cancel; no Stock change |
| Sale complete, Sync waiting | Success for cashier + "Menunggu unggah" chip |
| Sync fail | Keep Sale complete; retry; **do not** block next Sale |
| Day Close + unsynced | Hard block finish until Sync or acknowledge |
| After Day Close confirm | Return to Account Login; prior PIN session dead |
| catalog_admin vs cashier on Dashboard | Mutate vs read-only (API enforced) |
| Empty catalog on Cashier | Empty Menu + guidance to pull/sync catalog when online |
| Theme | Follow system until user overrides |

## Interaction Primitives

**Cashier (touch-first, multi-surface):**

- Primary input: large tap targets; thumb-friendly PIN pad and Pay.
- Cart qty: steppers, not tiny icon-only hits.
- Keyboard shortcuts optional on laptop Cashier (not required for Phase 1 acceptance).
- Banned: hover-only actions on phone; multi-step wizards for ring-up; blocking modal on Sync failure.

**Dashboard (pointer-first):**

- Standard shadcn forms/tables; Enter submits forms where safe.
- No Offline Mode affordances.

## Accessibility Floor

- WCAG 2.2 AA on both apps (shadcn defaults + brand blue/amber checked for contrast).
- Focus visible (`ring`); PIN pad and Pay operable by keyboard on laptop.
- Sync and Offline status announced via visible text + `aria-live` polite for chip changes — never only color.
- Target sizes ≥ 48px Cashier controls.
- Language switch does not rely on color alone.
- Do not put essential Checkout actions behind swipe-only gestures.

## Responsive & Platform

| Context | Behavior |
|---|---|
| Cashier `md+` | Menu left/main + Cart Panel right |
| Cashier `< md` | Menu full width; Cart as Sheet; same sale state |
| Cashier PWA | Installable; Local Database persists across restart |
| Dashboard desktop | Sidebar + content; not optimized as primary phone POS |
| Print Receipt | Browser print dialog **or** on-screen confirm (Phase 1 demo) |

## Inspiration & Anti-patterns

- **Lifted from counter POS muscle memory:** always-visible cart, big pay, PIN then sell.
- **Lifted from shadcn:** component vocabulary; brand is delta only.
- **Rejected:** Calling Sync-wait a “pending Sale”; alarm-red offline when selling still works; Dashboard-as-POS; chart dashboards in Phase 1; English-only chrome.

## Key Flows

### Flow 1 — UJ-1 Instant Checkout (Dewi, barista-cashier, busy morning)

1. Dewi opens Cashier PWA → **Account Login** (ID copy).
2. Enters **POS PIN** (6 digits) → **Cashier Menu** unlocks.
3. Taps products; **Cart Panel** (right) shows lines + prices; adjusts qty.
4. **Checkout** → records payment (cash / simple paid).
5. **Climax:** **Receipt** succeeds (print or on-screen confirm) → Sale is **complete**. Customer gets a normal finished sale.
6. If online, Sync may run; Stock updates on Dashboard after AcceptCompleteSale. If Sync waits, chip shows "Menunggu unggah" — Sale stays complete.

Failure: Receipt fails → Sale incomplete; retry/cancel; Stock unchanged.

### Flow 2 — UJ-2 Offline Mode (Dewi, Wi-Fi dies mid-shift)

1. Offline banner appears. Prior PIN material present → Dewi unlocks with POS PIN if needed.
2. Full loop on Local Database: Menu → Cart → Checkout → payment → Receipt.
3. **Climax:** Customer gets a normal **complete** Sale offline; nothing called “pending sale.”
4. On reconnect, Sync uploads; Dashboard Stock/list catch up. Sync failure retries; next Sale not blocked.

### Flow 3 — UJ-3 Day Close (Dewi, end of day)

1. Starts **Day Close** → sees sales total, cash summary, Sync status.
2. If unsynced complete Sales remain → finish **blocked** until Sync or **explicit acknowledge**.
3. Reviews **Today’s Sales Report** (transactions, totals, prices) → confirms.
4. **Climax:** Report matches her drawer expectation → session ends → **Account Login**. Prior POS PIN session cannot continue.

### Flow 4 — Stock the shop (Raka, catalog_admin)

1. Logs into Dashboard (desktop).
2. Creates/edits products (name, price, Stock qty) via AdjustStock path for qty.
3. Cashier later pulls catalog into Local Database; Menu reads Local DB only.
4. After Sync of complete Sales, Stock and sales list reflect reality.

Failure: cashier role attempts mutate → API 403; UI hides/disables edit.
