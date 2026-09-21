# Moat mobile screen review

Reviewed 21 September 2026. Scope: dashboard, navigation, transactions and capture, accounts, monthly plan, review workflows, report, goals, shopping, debt, projects, settings, reference and onboarding.

## Assessment and evidence

Moat has a useful set of focused financial tools, but the mobile arrangement often gives summaries and explanation more space than the task the user opened the page to do. The greatest improvement would come from changing information hierarchy and navigation stability, rather than adding more features or decoration.

This is an implementation-based UX review, with a browser walkthrough of the welcome and initial onboarding screens. A populated mobile dashboard was not visually tested: the fresh local instance requires onboarding consent, which was left untouched. Findings about render order, labels, conditional visibility and calculations are confirmed in source. Overflow, exact fold positions, keyboard behavior and perceived usability remain validation targets, not measured failures. No product code was changed.

The graft CLI was unavailable. Checked-in `graft/` cards supplied the source locations. No token-savings estimate was available. A matching managed Canvas directory was not present in the available project inventory, so this review is saved in the repository; the companion HTML provides illustrative arrangements.

## 1. Dashboard — change what wins the first screen

**High priority: the hero uses too much vertical space before the next action.** On mobile the 148px emergency-cover ring sits above the balance and three cash-flow rows. The attention panel only follows that entire card. The ring is useful brand language, but its current position makes the dashboard read as a financial report before it works as a daily check-in.

Recommended order:

1. Compact page title and period selector.
2. Current total balance, explicitly labeled as current rather than period-dependent.
3. Compact money-in / money-out summary for the selected period.
4. The most urgent actionable item, followed by at most two other attention items.
5. Three recent transactions and a clear “View all” link.
6. A small planning preview: upcoming bills and budget status, with a route to the full plan.
7. Compact emergency-cover status and a link to its explanation.
8. One useful trend preview linking to Report.

Let exceptional urgent states move immediately below the title. Avoid making all dashboard modules permanently expanded. There is already a collapsed balance explanation; retain that good choice rather than introducing another mandatory block. Recent transactions and a compact planning preview would replace some of the existing analytical content, not simply lengthen the page.

Sources: [DashboardWorkspace](../../components/dashboard-workspace.tsx#L45), [DashboardMoatHero](../../components/dashboard/dashboard-moat-hero.tsx#L53), [balance disclosure](../../components/dashboard/dashboard-balance-bridge.tsx#L9).

**High priority: fix the meaning of “months cover.”** The dashboard passes selected-period outflow as `monthlyOutflow`, and the hero divides total balance by it. The selector supports Week, Month, Year and All. Consequently, a week or year of spending is presented as a monthly expense denominator. The hook also uses that ratio for cover-related attention items. Even month-to-date spending can overstate cover early in the month.

Use an explicitly defined monthly spending baseline, independent of the dashboard filter—for example, an average of complete months with adequate history. Define which balances count as accessible reserves. Label the basis and show an insufficient-history state when appropriate. This is a data-definition correction, not financial advice or a recommendation about how much a particular user should save.

Sources: [period summary and cover calculation](../../components/dashboard/use-dashboard-workspace.ts#L118), [hero division](../../components/dashboard/dashboard-moat-hero.tsx#L75), [period windows](../../lib/domain/dashboard.ts#L138).

**Medium priority: reduce interpretation effort.** The savings overview combines a very large percentage, tagged savings, positive/negative bars, outflow bars and a three-part legend. Individual point values are exposed through `title` and accessibility labels, but there is no explicit touch-selection interaction in that chart. On mobile, a short sentence plus a simple trend can communicate more quickly. Put the full analysis in Report, support tapping a point to reveal a value and period, and retain a text equivalent. Keep “left after spending” distinct from money explicitly tagged as savings.

Source: [DashboardSavingsOverview](../../components/dashboard/dashboard-sections.tsx#L63).

## 2. Navigation — make it predictable

**High priority: keep every primary label visible.** Current mobile navigation only displays the active destination's text. Inactive Accounts and Transactions become icons that newcomers must interpret. The pill widths change with selection. Keep five fixed slots, with a short label below each icon: **Home · Activity · Add · Accounts · More**. “Activity” would be a navigation shorthand; the page can still be titled “Transactions.” The central Add control should remain visually distinguishable as an action.

**High priority: More must remain More.** It currently adopts the active grouped page's icon and label. On a rules page it can become “Rules & corrections,” although tapping it still opens the entire More menu. That breaks the relationship between a control's label and its action. Long active names also make the intrinsic-width pill a narrow-screen overflow risk. Keep the label and width stable; show the current page name in the page header and selected state inside the menu.

**High priority: restore visible screen titles.** Accounts, Transactions, Plan, Report, Settings and several other screens hide their main titles. Meanwhile the mobile top bar mostly contains the logo and an optional lock control. Use that space for orientation: page name on top-level screens; Back + title on details; Cancel + title on creation flows. A highlighted bottom icon is not a substitute for a heading.

Sources: [MobileNavigation](../../components/navigation/mobile-navigation.tsx#L23), [MobileMoreButton](../../components/navigation/navigation-sheets.tsx#L193), [navigation model](../../components/navigation/navigation-model.ts#L42), [Accounts](../../components/accounts-workspace.tsx#L93), [Report](../../components/report-workspace.tsx#L200).

**Medium priority: simplify More.** The current six cadence-themed groups are thoughtful but verbose, and the two-column layout gives long destination labels little room. Prefer a single-column list with three plain groups: Review (Inbox, Month check); Planning & analysis (Monthly plan, Goals, Money owed, Shopping, Projects, Report); Settings & help (Settings, Official sources). Put rules and categories inside Settings, with contextual shortcuts from review flows. Use counts for outstanding work, not decorative badges everywhere.

Do not immediately replace Accounts with Plan in the main bar. That is a plausible later variant, but task-frequency evidence is needed. First repair the existing bar without changing where familiar destinations live.

## 3. Transactions — show the ledger sooner

**High priority: the preamble displaces the primary content.** The frame inserts a summary with four baseline rows and up to three conditional rows. Two separate review banners can follow, then search, period chips and sort chips, before the first transaction.

Recommended order: visible title → search with Filters button → one compact review row when needed → date-grouped transactions. Put totals in an expandable summary or one compact line. Put sort choices inside Filters; leave only the active period visible. Preserve the existing date grouping, transfer pairing, direct transaction links and incremental loading.

**Medium priority: make filter scope honest.** The summary is explicitly monthly while the ledger has its own period filter. Either recalculate the displayed summary for the ledger selection or label it “This month's summary” and separate it clearly. A user should not infer that changing the list period also changed the totals.

Sources: [ledger](../../components/transactions-ledger-workspace.tsx#L51), [summary strip](../../components/transactions/transactions-summary-strip.tsx#L27), [frame](../../components/transactions/transactions-workspace-frame.tsx#L26).

## 4. Capture and forms — preserve the selected intent

The amount-first form and collapsed optional details are good. Keep both. The Add sheet already distinguishes Expense, Income, Transfer and Paste text; after choosing one, make the next screen title reflect it: “Add expense,” for example. The capture page currently retains a three-method selector even for a specific capture route. Make switching method secondary once the user has selected an intent.

Expose statement import in the Add chooser as a secondary “Import statement” action. It exists in the capture workspace but is absent from the four-item global chooser.

**High priority: make Save reachable on long forms.** Transaction submission is inside the scrolling form rather than supplied to the shell's sticky footer. Reuse a consistent keyboard-aware footer for Save and Cancel on full-screen mobile forms. Test actual keyboard behavior before claiming the footer remains accessible. Hide global navigation while a modal form is open, preserve unsaved input when appropriate, and return to the originating screen after completion.

Sources: [capture page](../../components/transactions-capture-workspace.tsx#L36), [transaction form](../../components/transactions/transaction-form.tsx#L181), [form shell](../../components/forms/form-card-shell.tsx#L17), [global capture actions](../../components/navigation/navigation-model.ts#L85).

## 5. Monthly plan — make budgets independently reachable

The plan correctly brings bills and budgets together. The arrangement, however, stacks the entire bills panel ahead of budgets. That panel can include outstanding, paid, not-due and paused bills, so budget access worsens as the user's history grows.

Keep a compact monthly headline, then **Budgets / Bills** tabs or clearly visible section shortcuts. Default to the user's previous selection; elevate overdue bills through a separate attention row. Collapse paid, paused and not-due groups. Preserve a direct link to either section: `/budgets` and `/recurring` currently redirect to `/plan` without selecting a section.

Sources: [MonthlyPlanWorkspace](../../components/monthly-plan-workspace.tsx#L15), [bill panel](../../components/transactions/recurring-obligations-panel.tsx#L198), [budget redirect](../../app/budgets/page.tsx#L4), [recurring redirect](../../app/recurring/page.tsx#L3).

## 6. Inbox and month check — organize around resolution

Keep the distinction between imported messages awaiting approval and month-level reconciliation. Make the relationship explicit: **Inbox: approve captured entries. Month check: resolve problems in recorded data.** Use the same terms in navigation, banners and page titles.

In Inbox, promote payee + amount to the first row and put account/date below. Currently account/date lead while payee is smaller. Allow warning reasons to wrap instead of truncating the reason the user needs to act. Increase the 32px approve control toward a 44–48px mobile hit area. Move rule/trust offers below the relevant decision or show them after approval so they do not repeatedly precede the queue.

In Month check, preserve the explicit checklist and grouped blockers. Collapse passed checks when there are unresolved ones; show a clear progress summary and one next issue. Make “Mark month as checked” the primary completion action and spreadsheet download secondary. Both currently sit in the same button row, with download first. Provide visible explanation whenever completion is disabled.

Sources: [review workspace](../../components/transactions-capture-review-workspace.tsx#L10), [review row](../../components/transactions/capture-review-row.tsx#L16), [month check panel](../../components/transactions/month-close-panel.tsx#L100).

## 7. Accounts — prioritize balances over maintenance

Keep the clear total and account list. Add the visible Accounts title, then compact total → account rows → contextual account actions. Give “Add account” precedence and demote Import to a secondary menu or the global Add chooser. When duplicate/repair notices exist, summarize them into one warning row rather than allowing maintenance panels to push the list down. Retain accessible detail views for resolving the issue.

Source: [AccountsWorkspace](../../components/accounts-workspace.tsx#L93).

## 8. Report — split the long analytical stack

The current report stacks position, cash flow, counterparties, movement costs, categories, allocation and calendar. Offer **Overview / Spending / Calendar** with a shared, clearly scoped period control. Overview should answer what changed and why; Spending should provide drill-downs; Calendar should focus on day-level lookup.

The calendar has its own month selector while the rest of the page uses a separate window. Separate views or explicit period labels would prevent users from assuming one control governs everything. Use “Net position” or another precisely defined metric label instead of the personal-sounding “What you are worth.” Define included accounts and debts rather than implying complete wealth coverage.

Source: [ReportWorkspace](../../components/report-workspace.tsx#L200).

## 9. Remaining screens

**Goals:** The large active-goal count is less useful than progress and the next contribution. Lead with goal cards and New goal; use a compact count. If the emergency fund is the stated priority, avoid putting its explanation below every goal. Show one compact fund summary without duplicating the same goal in multiple dominant sections. Make investment guidance an explicit secondary destination or collapsed section. [Source](../../components/goals-workspace.tsx#L30).

**Shopping:** Keep the active checklist dominant. The “Bought N” action currently lives above the list; after selecting lower items, users may need to scroll back. Use a contextual selection footer above the safe area. Put bought history and price trends behind secondary views. Make the transition from checking an item off to linking/creating its expense explicit. [Source](../../components/shopping-workspace.tsx#L76).

**Money owed:** Start with “I owe / Owed to me” and relevant people or loans. The current workspace renders a debt payoff planner before both party bands. Put planning inside the relevant debt detail or an optional tool. Replace the transfer-based empty-state instructions with guided “Record money lent” and “Record money borrowed” actions that preselect the correct transaction intent. [Source](../../components/debt-workspace.tsx#L20).

**Projects:** Use compact project summaries with remaining budget and a detail screen. Rendering every project's category breakdown in the list makes the page grow with both project count and category count. Put closed projects behind an archive filter and “Close project” in the detail menu. Shorten the introductory explanation. [Source](../../components/projects-workspace.tsx#L140).

**Settings:** Replace the stack of full security, storage, backup and data panels with a settings index. Put current storage/backup status first; drill into Security, Backup & sync, Capture, Categories & rules, Appearance, and Data management. Keep destructive controls in the data-management detail. This preserves access without making every visit a tour of every configuration form. [Source](../../components/settings-workspace.tsx#L78).

**Official sources:** Lead with topic selection and useful links. Move the three-principle introduction below the resources or collapse it. Allow important resource names to wrap. Make the external-link affordance persistent on touch; it currently becomes visible on hover. [Source](../../components/learn-workspace.tsx#L45).

**Onboarding:** “Get back into Moat” assumes a returning user even when Start fresh is offered. Use “Welcome to Moat,” with Start fresh primary and Restore existing data secondary. The initial profile step asks about income, salary timing, risk tolerance and planning horizon. Defer risk/horizon questions until goals/guidance needs them, if the underlying model permits, so users can reach their first account sooner. Preserve consent and the restore path. These initial screens were also observed in the browser. [Source](../../components/onboarding-workspace.tsx#L24).

## Mobile acceptance criteria

These are proposed design targets, not results already measured:

- At 390 × 844, a populated Home shows current balance, period cash flow and the first relevant action before substantial scrolling.
- A typical Transactions first view shows at least three normal rows; exceptional warnings may take precedence. At large text sizes, prioritize correct reflow over this row-count target.
- Test 320, 360, 390 and 430 CSS-pixel widths; long labels; large UGX values; negative balances; empty, populated and error states.
- Primary labels never disappear or change meaning. More never becomes another destination's name.
- Confirm 200% text scaling, keyboard focus, screen-reader names, contrast and reduced-motion behavior. Do not clip monetary amounts to conceal overflow.
- Aim for 44–48px touch targets on frequent controls. WCAG 2.2 AA's target-size criterion has a 24 × 24 CSS-pixel baseline and exceptions; a 32px control is therefore not automatically a WCAG failure. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Test forms on an actual iPhone/PWA with the keyboard open, safe-area insets, long selectors, validation errors and unsaved changes.
- Users can return from a detail or edit view to the previous list position and filters.
- Switching the dashboard period never changes the definition of “months cover.”

## Suggested delivery order

1. Correct cover-period semantics; stabilize navigation labels and More; add visible page titles.
2. Compact the dashboard hero; bring attention and recent activity up; simplify the transaction preamble.
3. Add budget/bill section navigation and unify mobile form headers/footers.
4. Improve review rows and completion actions; split Report and Settings into focused views.
5. Refine the secondary screens after testing real tasks on a populated phone.

Validate with representative tasks: record an expense, find yesterday's transaction, check this month's remaining budget, approve a captured message, inspect an account and return, and locate backup settings. Observe wrong turns, hesitation, scrolling and completion time. The proposed hierarchy is a strong starting hypothesis, not a substitute for that user evidence.
