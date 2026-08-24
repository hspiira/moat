# Moat, Information Architecture Review

**Date:** 2026-07-29
**Scope:** Navigation structure, screen-level content organisation, and the gap between advertised and implemented features.
**Companion to:** [technical-and-commercial-assessment.md](technical-and-commercial-assessment.md)
**Basis:** Direct measurement of the repository. All counts are reproducible from source.

---

## Summary

Moat's mobile bottom navigation is well chosen and needs no structural change. The problems sit in three other places:

1. **The daily dashboard renders ten sections**, two of which duplicate content shown elsewhere on the same screen. Nothing is ranked, so nothing reads as important.
2. **Four of the deepest features in the codebase have no navigation entry anywhere**, not in the bottom bar, not in the More sheet, not in the desktop sidebar.
3. **Two features are advertised as destinations with substantially less behind them than the billing implies**, which risks a first-time user concluding the product is thinner than it actually is.

The most consequential finding for current work: the approved visual refresh spec redesigns the pre-onboarding home screen, seen once, and does not touch the daily dashboard, which is the only screen the sole active user sees every day.

---

## 1. Navigation, as it actually stands

### 1.1 Mobile, correct as designed

`components/navigation/mobile-navigation.tsx` renders five slots:

| Slot | Destination |
|---|---|
| 1 | Home |
| 2 | Transactions |
| 3 | Capture (sheet trigger) |
| 4 | Accounts |
| 5 | More (sheet trigger) |

Goals, Compass, and Learn are **not** in the bottom bar. They live in the More sheet via `mobileSecondaryNav`, alongside Settings and Privacy.

This is a sound hierarchy: the three highest-frequency destinations plus the primary action are immediately reachable, and lower-frequency destinations are one tap deeper. **No change recommended.**

*(An earlier verbal review of this project incorrectly stated that Compass and Learn occupied bottom-nav slots. They do not. The corrected position is recorded here.)*

### 1.2 Desktop, flat, and inaccurately weighted

`components/navigation/desktop-navigation.tsx` maps over `navItems` and renders all six destinations with identical visual weight: Home, Accounts, Transactions, Goals, Compass, Learn.

Desktop therefore presents Compass and Learn as peers of Transactions and Accounts. Given the depth disparity documented in §2, this over-represents them.

### 1.3 Deep features labelled by mechanism rather than by purpose

> **Correction (2026-07-29).** An earlier revision of this section claimed these
> four features had "no navigation entry anywhere." That is wrong, all four are
> reachable. Verified mount points and link paths are below. The real defect is
> narrower and is a naming problem, not a missing-route problem.

| Feature | Domain logic | Mounted in | Reached via |
|---|---|---|---|
| Debt payoff planner | `debt.ts`, 302 lines | `accounts-workspace.tsx` | Accounts (bottom nav) |
| Recurring obligations | `recurring.ts`, 227 lines | `transactions-review-workspace.tsx` | Transactions → "Open review"; More → "Review month close" |
| Insights | `insights.ts`, 150 lines | Dashboard panel | Home |
| Budgets | `budgets.ts`, 145 lines | `transactions-tools-workspace.tsx` | More → "Rules & corrections" |

Together these are **824 lines of domain logic**, more than the summaries,
goals, guidance, rules, and transfers modules combined.

The defect is that two of the four are reached through labels that describe the
*container* rather than the capability:

- **"Rules & corrections"** leads to a screen hosting transaction rules,
  **budgets**, and the correction log. A user looking for budgeting has no
  reason to open it; "budgets" appears only third in the row's description text.
- **"Review month close"** leads to the screen hosting **recurring
  obligations**. Nothing in the label suggests recurring bills live there.

Debt and Insights are adequately placed and need no change.

---

## 2. Advertised versus implemented

### 2.1 Investment Compass

**Advertised as:** *"Rule-based guidance for Uganda investments"*, a named destination in both the More sheet and the desktop sidebar, with its own route and workspace.

**Implemented as:** `lib/domain/guidance.ts`, 57 lines. The complete decision logic is:

- three branches on `timeHorizonMonths` (under 12, 12–36, over 36), each returning a fixed list of product-name strings;
- one boolean check for emergency-fund cover below three months;
- one boolean check for high-cost debt;
- one check for immediate liquidity need.

There are no rates, no amounts, no yields, no comparison, and no arithmetic of any kind. The output is a hardcoded string list plus warning text.

**Assessment:** the underlying advice is sound and the emergency-fund-and-debt-first sequencing is correct. But as a standalone destination it presents as an empty room. The same content delivered *contextually*, when a user sets a goal with a given horizon, would read as helpful rather than sparse.

### 2.2 Learn

**Advertised as:** *"Official Uganda finance sources and references."*

**Implemented as:** eight seeded links (`defaultResourceLinks` in `lib/app-state/defaults.ts`), Bank of Uganda, CMA (twice), Uganda Securities Exchange, URBRA, UMRA, UBOS, FinScope, grouped into three topics and rendered by a 180-line workspace.

The interface is roughly 22× the volume of the content it presents.

**Assessment:** eight curated regulator links is genuinely useful reference material, but it is a reference list, not a learning module. The naming and destination-level billing set an expectation the content does not meet.

### 2.3 Sync

Settings exposes a sync mode panel, and a full conflict-resolution screen exists at `/settings/sync-conflicts`. The backing API returns HTTP 501 by default and is documented in-source as unusable in production.

**Assessment:** the product advertises, in its own settings interface, a capability that cannot function. This should be hidden behind the same flag that gates the backend.

---

## 3. Screen-level content organisation

### 3.1 The daily dashboard renders ten sections

`components/dashboard-workspace.tsx` composes, in order:

1. `DashboardPeriodFilter`
2. `DashboardMoatHero`, runway, total balance, In / Out / Net
3. `DashboardQuickActions`
4. `DashboardCashFlowSection`, savings overview + summary tiles
5. `DashboardTopSpendingCategories`
6. `DashboardAccountBalances`
7. `DashboardBudgetCoverage`
8. `DashboardBalanceBridge`
9. `DashboardInsightsPanel`
10. `DashboardContinueLinks`

For comparison, each of the three reference applications supplied as design direction settles at approximately five blocks: one hero figure, two to three actions, and one list.

Ten peer-weighted sections provide no ranking. The reader is given no signal about what to attend to first, and the practical result is scrolling past everything.

`dashboard-sections.tsx` is 638 lines, the second-largest file in the repository.

### 3.2 Two concrete duplications

**Inflow and outflow appear twice.** `DashboardMoatHero` displays In, Out, and Net. `DashboardSummaryTiles`, rendered inside `DashboardCashFlowSection` two sections below, displays Inflow and Outflow again. Identical figures, same screen, no added context.

**`DashboardContinueLinks` duplicates navigation.** It links to modules already reachable from the bottom bar, occupying the screen's final position, the second-strongest position on a scrolling page, with redundant routing.

### 3.3 The hero is already correct, no change required

> **Correction (2026-07-29).** An earlier revision of this section claimed runway
> was rendered as "a small label" and should be promoted. That was drawn from a
> symbol search rather than the rendered component, and is wrong.

`DashboardMoatHero` computes `totalBalance / monthlyOutflow` and renders it as
the centre label of a **148px `MoatRing`**, tone-switched against a three-month
target, positioned to the left of the balance figure. The component's own
docstring states its intent precisely: *"Answers 'how protected am I?' before
'what's my balance?'"*

This is the most differentiated number in the product, nearly every finance
application displays a balance; very few answer *how long can I survive at
current burn*, and the existing design already treats it as such. Runway and
balance are visually co-equal, with In/Out/Net as a supporting band beneath.

**No change recommended.** This is the strongest screen in the application and
should be the reference point for the rest of the redesign, not a target of it.

---

## 4. Recommendations

### 4.1 Dashboard, reduce ten sections to five visible

| Action | Section | Rationale |
|---|---|---|
| **Keep unchanged** | Hero | Already correct, runway ring + balance (§3.3) |
| **Keep** | Period filter | Compact; consider sticky |
| **Keep** | Quick actions | Limit to three |
| **Keep** | Top spending categories | Genuine daily value |
| **Keep** | Account balances | Direct answer to "where is my money" |
| **Remove** | `DashboardSummaryTiles` | Duplicates hero In/Out (§3.2) |
| **Remove** | `DashboardContinueLinks` | Duplicates navigation (§3.2) |
| **Collapse** | Budget coverage | Show only when budgets are configured |
| **Collapse** | Balance bridge | Advanced reconciliation; on demand |
| **Collapse** | Insights | Surface only when an insight fires |

Result: five sections carrying the daily load, three available on demand, two removed.

### 4.2 Navigation

- **Mobile bottom bar:** no change.
- **Desktop sidebar:** separate the six flat entries into a primary group (Home, Transactions, Accounts) and a secondary group (Goals, Compass, Learn) so weight reflects actual depth.
- **Surface the buried four.** Debt, Recurring, Budgets, and Insights need discoverable entry points. Adding them to the More sheet is the lowest-cost option; promoting Budgets or Debt into the secondary tier is defensible given their depth.
- **Gate the sync UI** behind the same flag as its backend.

### 4.3 Compass and Learn, a decision, not a refactor

Three options, in recommended order:

1. **Merge Compass into Goals; retitle Learn.** Guidance is inherently contextual to a goal's horizon, delivered at the moment a user sets one, the existing 57 lines become genuinely useful rather than sparse. Learn becomes "Official sources" or similar: an accurate name for eight regulator links, removing the expectation gap without new content.
2. **Invest properly.** Real rate data for Compass; substantive explainers for Learn. Meaningful ongoing content cost, and it introduces regulatory exposure, investment guidance carrying real figures is a materially different compliance posture than a decision tree.
3. **Leave as-is.** Lowest effort; retains the expectation gap.

Option 1 is recommended: it improves perceived quality at near-zero cost and turns two thin destinations into one well-placed contextual feature plus one honestly-labelled reference list.

---

## 5. Consequence for the approved visual refresh

[2026-07-27-visual-refresh-design.md](../superpowers/specs/2026-07-27-visual-refresh-design.md) restyles the pre-onboarding home cards in `home-overview.tsx`, the screen a user encounters once, before creating an account, and explicitly places dashboard surfaces out of scope.

The sole active user passed that screen weeks ago. Under the current single-user decision recorded in the assessment document, the visual refresh as specified would improve a screen nobody sees while leaving the daily dashboard untouched.

**Recommendation:** extend the spec to cover the dashboard reorganisation in §4.1 before implementation. The nav portion of the spec requires no IA change, the mobile bar it describes is already correct.
