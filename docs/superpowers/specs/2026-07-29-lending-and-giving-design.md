# Lending, giving, and tips — design brief

**Date:** 2026-07-29
**Status:** Not started — brief for a fresh session
**Scope owner:** Henry Piira

## The request

Record money that leaves the account for people rather than purchases:

1. **Lent out** — expected back. Needs repayment tracking.
2. **Given** — family, friends, gifts. Not coming back.
3. **Tips** — small, not coming back.

## The decision that shapes everything

**These are not one feature.** They differ in accounting, and getting it wrong
corrupts two numbers the app is built on.

| | Lending | Giving / tips |
|---|---|---|
| What it is | A receivable — an **asset** | An **expense** |
| Net worth | Unchanged (cash → receivable) | Reduced |
| Savings rate | Should not count as spending | Counts as spending |
| Needs | Counterparty, repayment tracking, outstanding balance | A category |

If lending is recorded as an expense, lending a friend 500,000 makes it look
like the month collapsed, and the savings rate — which has property-based tests
guarding it (`lib/domain/accounting.property.test.ts`) — starts lying.

**Giving and tips are the easy half:** they are ordinary expenses. They likely
need nothing more than seeded categories ("Gifts & family", "Tips") in
`lib/app-state/defaults.ts`. Do not over-build them.

**Lending is the real feature.**

## The shortcut worth checking first

`lib/domain/debt.ts` (302 lines, the largest domain module) already models debt
owed **by** the user: payoff order, projected clear date, repayment actions,
portfolio summary. Lending is the mirror — debt owed **to** the user.

**Before writing anything parallel**, read `debt.ts` and establish whether:

- `getDebtSummary` / `getDebtPortfolioSummary` generalise over a sign flip
- `buildDebtPayoffPlan` inverts into "expected repayment schedule"
- an account of a `lent`/`receivable` type can reuse the existing machinery

A "who owes me what, and when" view may be nearly free. If the primitives do
not generalise cleanly, say so explicitly and build fresh — but check first.

## Open modelling question (needs a decision before code)

Two viable shapes:

**A. Lending as an account type.** A receivable is an account with a positive
balance; repayments are transfers into the source account. Reuses accounts,
ledgers, reconciliation, and probably `debt.ts`. Downside: an "account" per
borrower may feel heavy for a 20,000 loan to a cousin.

**B. Lending as a transaction type with a counterparty field.** Lighter to
record. Requires new aggregation logic to answer "what is outstanding", and a
new `counterparty` concept the schema does not have.

Recommendation: **A**, if `debt.ts` generalises — it inherits reconciliation and
balance-gap detection for free. Confirm with the founder before building.

## Constraints

- `lib/types.ts` — every entity carries `userId`; follow the existing shape.
- Records are encrypted at rest with HMAC blind indexes
  (`RECORD_ENVELOPE_VERSION = 2`). New stores must thread through
  `lib/repositories/` the same way, not around it.
- Any new route must be added to `APP_SHELL_URLS` in `public/sw.js` — a test
  guard fails the build otherwise (deliberate; it caught this on the last three
  routes).
- The domain layer is pure and synchronous. Money logic belongs in
  `lib/domain/`, not in components.
- Follow the mobile form treatment already applied to onboarding: 44px controls,
  no card padding stacked on the app shell's gutter.

## Verification

- Property test the invariant: **lending must not change net worth**, and
  repayment must not count as income.
- Extend `accounting.property.test.ts` rather than testing lending in isolation
  — the point is that it does not break existing accounting identities.

## Also outstanding (unrelated to lending)

- Page designs for `/budgets`, `/debt`, `/recurring` — currently `PageHeader` +
  a single panel, no summary band. See
  [information-architecture-review.md](../../product/information-architecture-review.md).
- Transactions page still stacks a summary strip and review banner above the
  ledger (IA review §3).
- App-wide form redesign; only onboarding has had the mobile pass.
- `HiddenFeeNotice` in the paste module is built and typechecks but has not been
  confirmed rendering in a browser — the dev server was serving stale compiles.
