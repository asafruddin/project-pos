---
title: 'Dashboard home UI refresh'
type: 'feature'
created: '2026-11-09'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2308e4988d99a763f223c8b9b5dfd7c1d85ba93f'
context: ['{project-root}/apps/dashboard/src/app/beranda-panel.tsx', '{project-root}/apps/dashboard/src/components/templates/dashboard-shell.tsx']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard home currently exposes the right data but presents it as a dense set of equal-weight cards and charts. The visual hierarchy, daily context, and scanability can be improved so a store operator can understand performance quickly.

**Approach:** Refresh the home dashboard presentation around a clear daily overview: a stronger welcome/context block, more readable KPI cards, clearer chart sections, and responsive spacing that preserves the existing dark/light theme and Indonesian copy.

## Boundaries & Constraints

**Always:** Preserve existing API calls, permissions, data calculations, routes, shared component conventions, theme tokens, and accessibility semantics. Keep the layout usable from mobile through wide desktop screens.

**Ask First:** Any change to the meaning of a metric, API response shape, navigation structure, or authentication/session behavior.

**Never:** Do not add mock business data, replace the existing chart primitives with a new dependency, change unrelated dashboard routes, or remove permission-gated content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| HAPPY_PATH | Reports and catalog data load | Overview renders readable KPIs, charts, and links with the current values | N/A |
| LOADING | Requests are pending | Layout shows stable skeleton structure without layout jump | N/A |
| EMPTY | No sales/products for the selected day | Sections remain useful and show existing empty-state copy | N/A |
| PARTIAL_ACCESS | User lacks reports, product, or financial permissions | Only allowed metrics/sections render; no restricted data is exposed | Existing permission behavior is preserved |
| API_ERROR | A report request fails | Existing alert remains visible and the rest of the page stays structurally usable | Existing error message is retained |

</frozen-after-approval>

## Code Map

- `apps/dashboard/src/app/beranda-panel.tsx` -- Home dashboard data orchestration and overview layout.
- `packages/ui/src/molecules/stat-card.tsx` -- Shared KPI card visual primitive; adjust only if needed to support the refreshed hierarchy without breaking other pages.
- `packages/ui/src/organisms/simple-chart.tsx` -- Existing bar chart primitives used by the home dashboard.
- `apps/dashboard/src/components/templates/dashboard-shell.tsx` -- Persistent dashboard frame and content spacing.
- `apps/dashboard/src/app/globals.css` -- Dashboard theme tokens and global styling.

## Tasks & Acceptance

**Execution:**
- [x] `apps/dashboard/src/app/beranda-panel.tsx` -- Rework the home overview hierarchy, KPI presentation, chart composition, and responsive layout while preserving all existing data/permission behavior -- make the screenshot’s dense presentation easier to scan.
- [x] `packages/ui/src/molecules/stat-card.tsx` -- Improve shared KPI typography/spacing only if required by the home refresh, keeping its public API compatible -- retain consistency with other dashboard screens.
- [x] `packages/ui/src/organisms/simple-chart.tsx` -- Improve chart readability for labels, empty states, and constrained widths without changing data inputs -- prevent the visualizations from becoming hard to interpret on smaller screens.
- [x] `apps/dashboard/src/components/templates/dashboard-shell.tsx` -- Reviewed; no shell change was required because the existing container already supports the refreshed home layout -- keep persistent navigation behavior unchanged.

**Acceptance Criteria:**
- Given a user with report access, when the dashboard loads, then the primary daily KPIs are visually prioritized and readable without horizontal overflow.
- Given a narrow viewport, when the dashboard is viewed, then cards and charts stack or resize cleanly and all labels remain understandable.
- Given loading, empty, partial-permission, or API-error states, when the home page renders, then the existing data-safety and messaging behavior remains intact.
- Given light or dark theme, when the page is viewed, then text, borders, surfaces, and status colors maintain accessible contrast and consistent theme tokens.

## Verification

**Commands:**
- `pnpm --filter @pos-apps/dashboard lint` -- expected: SUCCESS.
- `pnpm --filter @pos-apps/dashboard build` -- expected: SUCCESS.

**Manual checks:**
- Compare the home page at mobile, tablet, and wide desktop widths against the provided reference and confirm the KPI-to-chart reading order, keyboard focus, and no horizontal scrolling.

## Suggested Review Order

**Dashboard composition**

- Start with the home overview structure and permission-aware loading behavior.
  [`beranda-panel.tsx:137`](../../apps/dashboard/src/app/beranda-panel.tsx#L137)

- Review the daily overview call-to-action and KPI hierarchy.
  [`beranda-panel.tsx:178`](../../apps/dashboard/src/app/beranda-panel.tsx#L178)

- Check chart loading, responsive composition, and report handoff.
  [`beranda-panel.tsx:237`](../../apps/dashboard/src/app/beranda-panel.tsx#L237)

**Shared display primitives**

- Confirm KPI sizing is opt-in and preserves other StatCard consumers.
  [`stat-card.tsx:21`](../../packages/ui/src/molecules/stat-card.tsx#L21)

- Review chart spacing and accessible labels for constrained layouts.
  [`simple-chart.tsx:9`](../../packages/ui/src/organisms/simple-chart.tsx#L9)
