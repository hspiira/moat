# Moat — Insights that carry a number, and projects that explain a spike

| Field | Value |
| --- | --- |
| Status | Plan |
| Owner | Piira |
| Last Updated | 2026-08-20 |

## What is wrong now

`lib/domain/insights.ts` has six rules and every one restates a single field of
`MonthSummary`. "Largest spend: Transport" tells you what the ledger already
shows, then asks you to "confirm whether this level of spend is intentional".
"Heavy transfer activity detected" fires at four transfers.

Meanwhile the data that would make them useful is captured and never read by
any rule:

| Captured | Read by a rule today |
| --- | --- |
| Every fee as its own row (`feeParentId`) | No. Never summed anywhere in the app |
| `count` per category — 35 boda trips | No. Printed as "35×" and nothing else |
| Previous-period windows, `getChangePercent` | Only on the three Home totals |
| Counterparty aging (`isOverdue`, `daysSinceLastActivity`) | Only on `/debt` |
| `statedBalance` from SMS, `balance-gap.ts` | No |
| Line items, `price-observations.ts` | Only in `/shopping` |

## The test a rule must pass

**A number, a comparison, and one action.** All three, or it does not ship.

- "Transport is your biggest category" — none of the three.
- "Transport: 306,000 across 35 trips, 8,700 each, up 41% on the last three
  months" — a number, a comparison, and an obvious lever.

The `Insight` type therefore carries `headline`, `detail` and an optional
`action`, and a test asserts every rule's headline contains a digit. A rule that
cannot produce a number cannot compile past the suite.

## Rules to build

Ordered by value over effort. All but the last two use data already stored.

1. **Fee load.** Total charges for the period and what share of the money moved
   they represent. Mobile money charges are a real cost in Uganda and nothing in
   the app has ever added them up.
2. **Unit cost.** Amount divided by count for a repeated category, against the
   same figure last period. A total invites a shrug; a per-trip price invites a
   decision.
3. **Concentration.** The top category's share of spending, when it dominates.
4. **Category movement.** The biggest mover against the previous period.
5. **Money owed to you, aging.** Already computed in `party-ledger.ts`, only
   shown on `/debt`.
6. **Records against reality.** `statedBalance` from the sender's SMS against
   the balance Moat computed.
7. **Recurring detection.** Something charged monthly that is not tracked as an
   obligation yet.
8. **Item price movement.** From line items and price observations.

## Projects

A month can be abnormal for a good reason. Relocation pushes rent, transport
and furniture up at once, across categories and across months. Today the app can
only say "Rent up 300%", which reads as a warning when it is a plan.

A project is a **cost centre**, not a category. It cuts across categories,
accounts and months, and it ends. So it is a separate dimension:

- A `projects` store: name, when it started, when it ended, an optional budget.
- `Transaction.projectId`, optional.

What it buys, in order of why it is worth the schema change:

- **It explains a spike.** "Rent up 300%, and 2,000,000 of that is tagged
  Relocation" turns an alarm into a fact.
- **It gives a baseline worth comparing against.** Every rule above can exclude
  project spending, so ordinary months are compared with ordinary months instead
  of being polluted by a one-off.
- **It totals a one-off that categories cannot.** "Relocation has cost 4,300,000
  across 5 categories and 3 months, against a 4,000,000 budget."

Adding a store touches the IndexedDB schema version, `data-export.ts`,
`entity-sync.ts`, `id-references.ts` and the e2e seed. `id-references` has a test
that fails if an id-shaped field in `lib/types.ts` is not registered, which will
catch `projectId` if it is missed.

## Where this stands, 2026-08-21

All eight rules above are built, and so are two of the five gaps below.

- **Near-term runway.** Done. `lib/domain/runway.ts`. Spendable balance means
  cash, mobile money and bank; a SACCO share or an investment holding is savings
  you would have to liquidate and a receivable is somebody else's promise, so
  none of them answer "am I about to run out". The daily rate divides by the
  history that exists rather than the window asked for, because five days of
  entries over a thirty day window is a five day average. Quiet past 45 days of
  room, urgent at a fortnight.
- **Income stability.** Done. `lib/domain/income-stability.ts`. Reports the
  worst month, the best and the middle, and says to plan on the worst. The month
  in progress is excluded, since counting a half-finished month would drag the
  low end down every time and make every month look bad.
- **Net worth over time.** Already covered, and not rebuilt: the report's "What
  you are worth" chart is `buildPositionSeries` over a 7, 30 or 90 day window.
- **Sinking funds.** Not started. Needs a store of its own — accruing monthly
  toward a known irregular cost is not a goal with a target date, and not a
  budget envelope either.
- **Seasonality.** Not started, and not worth starting yet: school terms and the
  festive season only show up with more than a year of history to compare.

## Other personal finance ground already covered

Worth stating so it is not rebuilt: envelope budgets, goals with contribution
plans, a debt payoff planner, emergency fund months of cover, rule-based
investment guidance, planned purchases with price tracking, recurring
obligations, month close, and a lending and borrowing subsidiary ledger all
exist.

Genuinely missing, beyond the rules above:

- **Near-term runway.** Months-of-cover answers the emergency fund question.
  It does not answer "at this rate, what is left on the 24th".
- **Income stability.** Irregular income is normal here. Budgeting on the
  lowest of the last six months is safer than budgeting on the average.
- **Sinking funds.** Accruing monthly toward a known irregular cost — school
  fees, annual insurance — rather than a goal with a target date.
- **Net worth over time.** "Your moat" is a point in time; the direction is
  what matters.
- **Seasonality.** School terms and the festive season are predictable spikes.
