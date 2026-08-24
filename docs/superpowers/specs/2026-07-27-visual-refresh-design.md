# Nav, home cards, and color system refresh, design

**Date:** 2026-07-27
**Revised:** 2026-07-29, added §4 (daily dashboard) following the information architecture review
**Status:** Approved (design)
**Scope owner:** Henry Piira
**Related:** [information-architecture-review.md](../../product/information-architecture-review.md)

## Problem

Three pieces of feedback on the current UI, verified against three reference
screenshots (a shipping-tracker app, a wallet/installments app, and a "Material iOS"
concept):

1. The bottom nav is a full-width bar flush to the screen edge, with 5 labeled
   icons, reads as cluttered next to the floating, icon-only pill bars in the
   references.
2. The three pre-onboarding home cards (`components/home-overview.tsx`) are
   identical flat panels with no visual hierarchy, nothing anchors the eye first.
3. The color system (`app/globals.css`) is a warm teal/parchment/earth palette that
   reads as "off": dark mode's desaturated teal-gray background looks murky rather
   than crisp, borders are too solid, and there are more competing accent hues than
   the UI actually needs.

Direction was worked out interactively against four mockups (published as Artifacts
during the session) covering nav layout, home-card layout, color candidates, and
icon treatment. This document records the approved result.

## Decision

- **Nav**: floating solid-capsule bar (not card-colored, a genuinely separate
  dark/light object), 16px inset from the screen edges. 5 destinations stay (Home,
  Transactions, Accounts, More, plus capture), icon-only throughout, no labels.
  The **active item is a plain filled circle** (icon recolored, no expanding
  label, reverted from an earlier icon+label pill exploration). The capture
  button breaks out of the bar as a raised circular FAB in an off-white fill for
  contrast, unchanged in position from the current design.
- **Home cards**: the first card ("Cash flow") becomes a solid-primary "hero"
  block; "Emergency first" and "Rule-based guidance" become quiet outlined cards
  beneath it. One clear entry point instead of three competing ones.
- **Color**: replace the warm teal/parchment/earth base with a **deep emerald**
  direction, true near-black/near-white neutrals (fixes murky dark mode), a
  richer/more saturated primary, and much softer hairline borders (~7% opacity vs.
  the current 12%, mixed into a low-chroma neutral rather than a distinct border
  hue). `pos` (positive/inflow money color) folds into the same emerald family;
  `neg` (destructive/outflow) is untouched. This is a **base-token change only**,
  the existing `moat-panel-yellow/lilac/mint/sage` accent-panel system (used in
  `accent-metric-card`, `accent-card-header`, CSV import, dashboard sections) is
  **out of scope** and stays exactly as-is; it wasn't part of the feedback and
  touching it would ripple into screens never discussed.
- **Radius**: base `--radius` increases from `0.25rem` to `0.85rem`, cascading
  automatically through the existing `--radius-{sm,md,lg,xl,2xl,3xl,4xl}` chain
  that `card.tsx`/`button.tsx`/`input.tsx` already consume, no direct edits
  needed to those files. Small buttons (`xs`/`sm`) already cap their radius via
  `min(var(--radius-md), 10-12px)`, so they won't balloon into pills at the new
  base value.
- **Icons**: bottom-nav icons switch from Tabler outline to **Solar Bold Duotone**
  via `@solar-icons/react` (MIT licensed, actively maintained, React 19-compatible,
  per-icon tree-shakeable subpath exports, same import shape as the current
  Tabler usage). Scoped to the 5 bottom-nav icons only; everywhere else in the app
  keeps Tabler outline. (A competing package, `solar-icon-set`, was found and
  rejected, it's GPL-3.0, a real licensing risk for a commercial app.)

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
- ~~`chart-2` **is live**, feeds the conic-gradient in `.moat-pie`~~
  **Superseded 2026-07-29.** The landing-page rewrite removed the `.moat-pie`
  graphic (a "3" over a conic-gradient wedge, which read as decorative-cryptic
  rather than informative). `.moat-pie` was its only consumer and `--chart-2`
  was `.moat-pie`'s only consumer, so both were deleted along with
  `--color-chart-2`. No retune needed.

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

New, theme-invariant (same value in light and dark, the reference crops show a
nav bar that stays dark regardless of the surrounding app theme, a deliberate
signature element rather than a themed surface):

```
--nav-bar: oklch(0.15 0.008 165);
--nav-bar-foreground: oklch(0.6 0.02 165);      /* inactive icon color */
--nav-bar-active: oklch(0.7 0.13 165);          /* dark-mode primary, used even in light mode */
--nav-bar-active-foreground: oklch(0.14 0.01 165); /* icon color on the active circle */
--nav-bar-capture: oklch(0.96 0.005 165);       /* off-white capture FAB fill */
--nav-bar-capture-foreground: oklch(0.15 0.008 165); /* icon color on the capture FAB */
```

Untouched: `--neg`, `--destructive`, `--clay`/`--clay-foreground` (kept as the one
deliberate warm counterpoint, used in `pin-lock-screen.tsx`, `goal-list.tsx`,
`moat-ring.tsx`, `transactions-summary-strip.tsx`), `--moat-surface-{yellow,lilac,
mint,sage}` and their `.moat-panel-*` classes, `--sidebar-*` (desktop-only, not
part of this pass).

Deleted: `--moat-surface-olive`, `--moat-surface-ink`, `.moat-panel-olive`,
`.moat-panel-ink`, `--chart-1`, `--chart-3`, `--chart-4`, `--chart-5` and their
`--color-chart-{1,3,4,5}` `@theme inline` wiring, confirmed zero consumers above.

Already removed 2026-07-29 as part of the landing-page rewrite: `.moat-pie`,
`--chart-2`, `--color-chart-2`, and the `AppAsideIntro` component (its only
caller was the old landing-page hero aside).

### 2. Bottom nav (`components/navigation/mobile-navigation.tsx`,
`components/navigation/navigation-shared.tsx`)

- Bar container: swap from `bg-background/96` flush-to-edge to an inset floating
  capsule, `position: fixed` with margin on all sides (matches the existing
  `.fixed inset-x-0 bottom-0` wrapper, just adding horizontal/bottom insets and
  `rounded-full`), background `var(--nav-bar)` (theme-invariant dark, see token
  table above, not `var(--card)`, needs to read as a distinct floating object
  per the reference crops, confirmed in the final mockup).
- Active item (`renderNavButton` in `mobile-navigation.tsx`): currently toggles
  `variant="secondary"` vs `"ghost"` with an icon-over-label `flex-col` layout.
  Change to icon-only for every item (drop the label span entirely from the
  bottom nav, it's already redundant with 5 recognizable icons), with the
  active item getting `bg-[var(--nav-bar-active)]
  text-[var(--nav-bar-active-foreground)] rounded-full` on its circular hit
  target and inactive items `text-[var(--nav-bar-foreground)]` on a transparent
  one.
- Capture button: raised circular FAB, `bg-[var(--nav-bar-capture)]
  text-[var(--nav-bar-capture-foreground)]`, off-white, distinct from the
  emerald `--nav-bar-active` circle so the capture action doesn't compete
  visually with whichever destination is currently active.
- Icons: add `@solar-icons/react` as a dependency. In `mobile-navigation.tsx`,
  replace the Tabler icon components used for the 5 bottom-nav destinations with
  their Solar equivalents, rendered with `weight="BoldDuotone"` (a `SolarProvider`
  wrapping the nav can set this as the default once rather than repeating the prop
  per icon):
  - Home → `Home2`
  - Transactions → `TransferHorizontal`
  - Accounts → `Buildings2`
  - Capture → `AddCircle`
  - More → `HamburgerMenu`

  Exact `BoldDuotone` path data for all five (confirmed against the installed
  package, not approximated) is in the published mockup from this session. Other
  icon usages via `navIcons` in `navigation-shared.tsx` (desktop nav, the "more"
  sheet, everywhere else in the app) keep the existing Tabler outline rendering,
  this is a bottom-nav-specific change, not a site-wide icon library swap.

### 3. Home pre-onboarding cards (`components/home-overview.tsx`, ~lines 76-112)

Replace the three `moat-panel-{yellow,lilac,mint}` cards with:

- Card 1 ("Cash flow"): `bg-primary text-primary-foreground`, same content,
  becomes the hero.
- Cards 2 and 3 ("Emergency first", "Rule-based guidance"): `bg-card
  border border-border`, quiet.

No copy changes. No change to the `AppSectionHeading` above them or anything
below the three-card grid.

### 4. Daily dashboard (`components/dashboard-workspace.tsx`, `components/dashboard/`)

> Added 2026-07-29. The original spec covered only the pre-onboarding home
> screen (§3), which a user sees once before creating an account. The daily
> dashboard, the only screen the sole active user sees regularly, was out of
> scope. Restyling the former while ignoring the latter would improve a screen
> nobody revisits. Rationale and measurements: IA review §3 and §5.

`dashboard-workspace.tsx` currently composes ten peer-weighted sections. Reduce
to five carrying the daily load, three on demand, two removed.

**Remove (both are duplications, IA review §3.2):**

- `DashboardSummaryTiles`, renders Inflow/Outflow, already shown as In/Out in
  `DashboardMoatHero` two sections above. Delete the `summaryTiles` prop from
  `DashboardCashFlowSection`, leaving it to render `DashboardSavingsOverview`
  alone; drop the now-unused `summaryTiles` construction in
  `use-dashboard-workspace.ts` (~line 128).
- `DashboardContinueLinks`, links to modules already in the bottom nav, and
  occupies the page's final position. Remove the component and its
  `modulePreviews` prop.

**Collapse behind a condition or disclosure:**

- `DashboardBudgetCoverage`, render only when at least one budget exists.
- `DashboardBalanceBridge`, advanced reconciliation; move behind a disclosure
  control, collapsed by default.
- `DashboardInsightsPanel`, render only when `insights` is non-empty.

**Hero (`dashboard-moat-hero.tsx`), no structural change.**

A previous revision of this spec called for promoting runway to co-equal
billing with the balance. On reading the rendered component that instruction
was withdrawn: runway is already the centre label of a 148px `MoatRing` sitting
beside the balance, tone-switched against a three-month target. It is co-equal
today. Apply the §1 color tokens and radius; change nothing else.

**Resulting order:** period filter → hero (unchanged) → quick actions (max
three) → savings overview → top spending categories → account balances, with
budget coverage and insights appearing only when they have content.

The three sections being made conditional currently render *empty-state
placeholder cards* rather than hiding, `dashboard-budget-coverage.tsx` shows a
"no budgets" card, `DashboardInsightsPanel` shows an `EmptyState`. On a fresh
or lightly-used account these placeholders are pure noise: they occupy prime
vertical space to report an absence. Return `null` instead.

Apply the §1 color tokens and §1 radius throughout. The `moat-panel-*` accent
classes used by `dashboard-sections.tsx` and `dashboard-balance-bridge.tsx`
stay untouched per the constraint above.

## Testing / validation

- No domain logic changes, `pnpm test` should be unaffected; run it anyway as a
  regression check.
- `pnpm typecheck` / `pnpm lint` after the nav markup change (conditional
  label rendering, new className branches).
- Manual visual check in both light and dark mode, since this is a token-driven
  change across the whole app:
  - Home route (pre- and post-onboarding)
  - Dashboard in each conditional state: no budgets configured, no insights
    firing, and `hasCoverSignal` false (no outflow recorded), the three cases
    §4 makes conditional must each degrade cleanly rather than leaving a gap
  - Bottom nav on a route where each of the 5 destinations is active
  - At least one screen using `moat-panel-*` (e.g. `accent-metric-card`) to
    confirm the new `--foreground`/`--border` values still contrast correctly
    against the untouched pastel panel colors
  - `.moat-pie` chart rendering with the retuned `--chart-2`
- No automated visual regression coverage exists for the interactive layer
  (documented gap in `docs/architecture/overview.md`), this stays a manual check.

## Out of scope

- `moat-panel-{yellow,lilac,mint,sage}` accent-panel system and everywhere it's
  used (dashboard, CSV import, accent metric cards), not part of the feedback.
- Desktop navigation (`desktop-navigation.tsx`), feedback was specifically about
  the mobile floating nav; desktop can follow in a later pass if wanted. The IA
  review separately recommends grouping its six flat entries into primary and
  secondary tiers; that is a navigation change, not a visual one, and is tracked
  there.
- Navigation destinations themselves. The IA review confirms the mobile bottom
  bar (Home, Transactions, Capture, Accounts, More) is correctly chosen and
  needs no restructuring, this spec restyles it without changing where it goes.
- Surfacing the four undiscoverable features (debt, recurring, budgets,
  insights), and the Compass/Learn consolidation decision, both are IA changes
  requiring founder sign-off, tracked in the IA review §4.2–4.3.
- Replacing Tabler with Solar Bold Duotone anywhere outside the bottom nav (was
  explicitly considered and declined, see Icons decision above).
- Chart/data-visualization redesign beyond the minimal `--chart-2` retune needed
  to avoid a clash.
