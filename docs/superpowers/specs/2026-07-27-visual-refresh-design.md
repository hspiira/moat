# Nav, home cards, and color system refresh — design

**Date:** 2026-07-27
**Status:** Approved (design)
**Scope owner:** Henry Piira

## Problem

Three pieces of feedback on the current UI, verified against three reference
screenshots (a shipping-tracker app, a wallet/installments app, and a "Material iOS"
concept):

1. The bottom nav is a full-width bar flush to the screen edge, with 5 labeled
   icons — reads as cluttered next to the floating, icon-only pill bars in the
   references.
2. The three pre-onboarding home cards (`components/home-overview.tsx`) are
   identical flat panels with no visual hierarchy — nothing anchors the eye first.
3. The color system (`app/globals.css`) is a warm teal/parchment/earth palette that
   reads as "off": dark mode's desaturated teal-gray background looks murky rather
   than crisp, borders are too solid, and there are more competing accent hues than
   the UI actually needs.

Direction was worked out interactively against four mockups (published as Artifacts
during the session) covering nav layout, home-card layout, color candidates, and
icon treatment. This document records the approved result.

## Decision

- **Nav**: floating solid-capsule bar (not card-colored — a genuinely separate
  dark/light object), 16px inset from the screen edges. 5 destinations stay (Home,
  Transactions, Accounts, More, plus capture), icons only for inactive items: the
  **active item expands into an icon+label pill** instead of a plain icon
  highlight. The capture button breaks out of the bar as a raised circular FAB,
  unchanged in position from the current design.
- **Home cards**: the first card ("Cash flow") becomes a solid-primary "hero"
  block; "Emergency first" and "Rule-based guidance" become quiet outlined cards
  beneath it. One clear entry point instead of three competing ones.
- **Color**: replace the warm teal/parchment/earth base with a **deep emerald**
  direction — true near-black/near-white neutrals (fixes murky dark mode), a
  richer/more saturated primary, and much softer hairline borders (~7% opacity vs.
  the current 12%, mixed into a low-chroma neutral rather than a distinct border
  hue). `pos` (positive/inflow money color) folds into the same emerald family;
  `neg` (destructive/outflow) is untouched. This is a **base-token change only** —
  the existing `moat-panel-yellow/lilac/mint/sage` accent-panel system (used in
  `accent-metric-card`, `accent-card-header`, CSV import, dashboard sections) is
  **out of scope** and stays exactly as-is; it wasn't part of the feedback and
  touching it would ripple into screens never discussed.
- **Radius**: base `--radius` increases from `0.25rem` to `0.85rem`, cascading
  automatically through the existing `--radius-{sm,md,lg,xl,2xl,3xl,4xl}` chain
  that `card.tsx`/`button.tsx`/`input.tsx` already consume — no direct edits
  needed to those files. Small buttons (`xs`/`sm`) already cap their radius via
  `min(var(--radius-md), 10-12px)`, so they won't balloon into pills at the new
  base value.
- **Icons**: keep the existing Tabler outline icon set used everywhere in the app
  (no new dependency, no coverage gaps) but wrap nav icons in a **gradient +
  inset-shadow chip** for a glossy, raised feel — an approximation of the
  reference images' 3D icons without the cost/licensing/coverage problems of
  sourcing a real 3D icon pack.

## Verified codebase facts (corrects an earlier assumption made mid-session)

- `moat-surface-{yellow,lilac,mint,sage}` **are live**, consumed via
  `.moat-panel-*` utility classes in `app/globals.css`, and rendered in
  `home-overview.tsx`, `accent-card-header.tsx`, `ui/accent-metric-card.tsx`,
  `transactions/csv-import-sections.tsx`, `dashboard/dashboard-sections.tsx`,
  `dashboard/dashboard-balance-bridge.tsx`. **Do not remove or retune these.**
- `moat-surface-{olive,ink}` and `chart-{1,3,4,5}` have zero consumers anywhere
  (`.moat-panel-olive`/`.moat-panel-ink` are defined but never applied; no
  component references `chart-1`, `chart-3`, `chart-4`, or `chart-5` /
  `color-chart-1/3/4/5`). Safe to delete as part of this change since the file is
  already being edited.
- `chart-2` **is live** — feeds the conic-gradient in `.moat-pie`
  (`home-overview.tsx`). Must be retuned to fit the new palette, not deleted.

## Design

### 1. Color tokens (`app/globals.css`)

Light mode:

```
--background: oklch(0.985 0.004 165);
--foreground: oklch(0.16 0.01 165);
--card: oklch(0.995 0.002 165);
--card-foreground: oklch(0.16 0.01 165);
--primary: oklch(0.48 0.13 165);
--primary-foreground: oklch(0.99 0.01 150);
--muted: oklch(0.96 0.004 165);
--muted-foreground: oklch(0.5 0.01 165);
--border: oklch(0.75 0.01 165 / 14%);
--pos: oklch(0.5 0.12 160);
--radius: 0.85rem;
```

Dark mode (`.dark` / `[data-theme="dark"]`):

```
--background: oklch(0.15 0.008 165);
--foreground: oklch(0.96 0.005 165);
--card: oklch(0.18 0.01 165);
--card-foreground: oklch(0.96 0.005 165);
--primary: oklch(0.7 0.13 165);
--primary-foreground: oklch(0.14 0.01 165);
--muted: oklch(0.22 0.01 165);
--muted-foreground: oklch(0.68 0.02 165);
--border: oklch(1 0 0 / 7%);
--pos: oklch(0.72 0.13 160);
```

New, theme-invariant (same value in light and dark — the reference crops show a
nav bar that stays dark regardless of the surrounding app theme, a deliberate
signature element rather than a themed surface):

```
--nav-bar: oklch(0.15 0.008 165);
--nav-bar-foreground: oklch(0.6 0.02 165);   /* inactive icon color */
--nav-bar-active: oklch(0.7 0.13 165);        /* dark-mode primary, used even in light mode */
--nav-bar-active-foreground: oklch(0.14 0.01 165);
```

Untouched: `--neg`, `--destructive`, `--clay`/`--clay-foreground` (kept as the one
deliberate warm counterpoint — used in `pin-lock-screen.tsx`, `goal-list.tsx`,
`moat-ring.tsx`, `transactions-summary-strip.tsx`), `--moat-surface-{yellow,lilac,
mint,sage}` and their `.moat-panel-*` classes, `--sidebar-*` (desktop-only, not
part of this pass).

Retuned (not deleted): `--chart-2`, to sit in the new emerald family rather than
the old teal hue, so `.moat-pie` doesn't clash.

Deleted: `--moat-surface-olive`, `--moat-surface-ink`, `.moat-panel-olive`,
`.moat-panel-ink`, `--chart-1`, `--chart-3`, `--chart-4`, `--chart-5` and their
`--color-chart-{1,3,4,5}` `@theme inline` wiring — confirmed zero consumers above.

### 2. Bottom nav (`components/navigation/mobile-navigation.tsx`,
`components/navigation/navigation-shared.tsx`)

- Bar container: swap from `bg-background/96` flush-to-edge to an inset floating
  capsule — `position: fixed` with margin on all sides (matches the existing
  `.fixed inset-x-0 bottom-0` wrapper, just adding horizontal/bottom insets and
  `rounded-full`), background `var(--nav-bar)` (theme-invariant dark, see token
  table above — not `var(--card)`, needs to read as a distinct floating object
  per the reference crops, confirmed in the final mockup).
- Active item (`renderNavButton` in `mobile-navigation.tsx`): currently toggles
  `variant="secondary"` vs `"ghost"` with icon-only content. Change so the active
  item renders icon + label inline inside a filled pill (`bg-[var(--nav-bar-active)]
  text-[var(--nav-bar-active-foreground)] rounded-full px-4`), while inactive
  items stay icon-only, no label, `text-[var(--nav-bar-foreground)]`, in a plain
  circular hit target. This means the label span currently rendered
  unconditionally under the icon needs to become conditional on `isActive`, and
  the layout needs to go from `flex-col` (icon over label) to `flex-row` (icon
  beside label) for the active state only.
- Icon depth: wrap each icon in a chip (`~34px`, `border-radius: var(--radius-md)`
  or circular to match the pill) with a gradient background and
  `box-shadow: inset 0 1px 1px rgba(255,255,255,.18), inset 0 -3px 5px
  rgba(0,0,0,.25)` — inactive chips use a muted-tone gradient off `--nav-bar`,
  the active chip uses a gradient off `--nav-bar-active`. Scoped to the bottom
  nav only (`mobile-navigation.tsx`) — other icon usages via `navIcons` in
  `navigation-shared.tsx` (desktop nav, the "more" sheet) keep the plain flat
  Tabler rendering; the chip treatment is a nav-bar-specific accent, not a
  site-wide icon system change.

### 3. Home pre-onboarding cards (`components/home-overview.tsx`, ~lines 76-112)

Replace the three `moat-panel-{yellow,lilac,mint}` cards with:

- Card 1 ("Cash flow"): `bg-primary text-primary-foreground`, same content,
  becomes the hero.
- Cards 2 and 3 ("Emergency first", "Rule-based guidance"): `bg-card
  border border-border`, quiet.

No copy changes. No change to the `AppSectionHeading` above them or anything
below the three-card grid.

## Testing / validation

- No domain logic changes — `pnpm test` should be unaffected; run it anyway as a
  regression check.
- `pnpm typecheck` / `pnpm lint` after the nav markup change (conditional
  label rendering, new className branches).
- Manual visual check in both light and dark mode, since this is a token-driven
  change across the whole app:
  - Home route (pre- and post-onboarding)
  - Bottom nav on a route where each of the 5 destinations is active
  - At least one screen using `moat-panel-*` (e.g. `accent-metric-card`) to
    confirm the new `--foreground`/`--border` values still contrast correctly
    against the untouched pastel panel colors
  - `.moat-pie` chart rendering with the retuned `--chart-2`
- No automated visual regression coverage exists for the interactive layer
  (documented gap in `docs/architecture/overview.md`) — this stays a manual check.

## Out of scope

- `moat-panel-{yellow,lilac,mint,sage}` accent-panel system and everywhere it's
  used (dashboard, CSV import, accent metric cards) — not part of the feedback.
- Desktop navigation (`desktop-navigation.tsx`) — feedback was specifically about
  the mobile floating nav; desktop can follow in a later pass if wanted.
- Any new icon library/asset pack (Option C from the icon-treatment mockup was
  declined).
- Chart/data-visualization redesign beyond the minimal `--chart-2` retune needed
  to avoid a clash.
