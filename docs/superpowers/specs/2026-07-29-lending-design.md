# Lending as a receivable account — design

**Date:** 2026-07-29
**Status:** Implemented, with the revisions in "Revision: pooling" below
**Scope owner:** Henry Piira
**Supersedes the open questions in:** [2026-07-29-lending-and-giving-design.md](2026-07-29-lending-and-giving-design.md)

## Summary

Record money lent to people as a **receivable account**. Lending and repayment
are balanced transfer pairs, so the two invariants the app is built on — net
worth is unchanged by lending, and repayment is not income — hold by
construction rather than by assertion.

Giving and tips need one seeded category each. They are not a feature.

## Findings that shaped this

### `lib/domain/debt.ts` does not generalise

The brief asked whether the debt primitives invert into "debt owed to the user".
They do not, and building on them would be actively harmful.

| Primitive | Verdict |
|---|---|
| `getDebtSummary` | Partial. Strip the interest/payoff/minimum-payment logic and ~15 trivial lines remain — not worth sharing. |
| `buildDebtPayoffPlan` | No. It optimises **the user's own choice** of where to send extra money. You do not choose when a borrower repays. Snowball/avalanche is meaningless for receivables. |
| `getDebtRepaymentActions` | No. Same reason — it allocates a budget the user controls. |
| Sign flip | Not needed. `getDebtSummary` already `Math.abs`es the balance ([debt.ts:124](../../../lib/domain/debt.ts)), which would *hide* a borrower overpayment rather than model it. |

**The interest machinery is a correctness hazard here.** Informal loans are
0%-interest. At `interestRate = 0`, `getMonthlyInterest` returns 0 and
`inferMinimumPayment` falls through to `DEFAULT_MIN_PAYMENT_RATE = 0.03`
([debt.ts:90](../../../lib/domain/debt.ts)). `getDebtSummary` would then report a
confident ~34-month payoff for *any* 0%-interest balance regardless of size.
Presenting that as an expected repayment date invents a schedule the borrower
never agreed to.

`lib/domain/lending.ts` is therefore written fresh and imports nothing from
`debt.ts`.

### The account and transfer layer *does* generalise — and it is the valuable half

- `buildTransferPair` ([transaction-builder.ts:68](../../../components/transactions/transaction-builder.ts))
  already emits a pair that sums to zero and shares one `transferGroupId`.
- `isTransferTransaction` ([transfers.ts:3](../../../lib/domain/transfers.ts))
  already excludes transfers from `inflow`/`outflow`, which feed `getSavingsRate`.
- `getAccountTotals` sums balances across non-archived accounts.

Composing these three makes both accounting invariants structural. The property
tests then guard the construction instead of being the only thing holding it up.

### Two corrections to the original brief

1. **Balance-gap detection is not inherited.** `detectBalanceGaps` runs off
   `statedBalance` parsed from SMS or notifications. No institution texts a
   statement for money a cousin owes, so receivables never produce checkpoints.
2. **Giving is mostly already built.** `defaults.ts` seeds "Family support" and
   "Church / giving". Only "Tips" is missing. No "Gifts & family" category.

## Data model

```ts
AccountType += "receivable"

Account.expectedRepaymentDate?: string   // ISO date, user-stated
```

The account `name` is the borrower ("Loan to Sarah"). Date lent and last
repayment are derived from the ledger, so they get no fields.

`expectedRepaymentDate` is the only new field, and it is user-stated by design.
The app must never infer a repayment date — that is the specific failure mode
identified in `debt.ts` above.

`normalizeOpeningBalance` gains a `receivable` branch forcing the value positive,
mirroring the existing `debt` branch that forces it negative.

## Recording flows

All three reuse existing code paths. No new `TransactionType`.

| Flow | Mechanism | Net worth | Savings rate |
|---|---|---|---|
| Lend | `buildTransferPair`: cash → receivable | Unchanged | Untouched |
| Repayment | `buildTransferPair`: receivable → cash | Unchanged | Untouched |
| Write off | `expense` on the receivable account | Falls by the amount | Counts as spending |

Write-off is the only flow that moves net worth, and it should: the loss is real
at the moment you accept it.

**Archiving is not a write-off.** `getAccountTotals` skips archived accounts, so
archiving a receivable with a positive balance would drop net worth with no
transaction explaining it. The account form must not offer archive as a way to
close out an unpaid loan.

## `lib/domain/lending.ts`

Pure and synchronous, per the domain-layer constraint. Imports nothing from
`debt.ts`.

```ts
export type ReceivableStatus =
  | "outstanding"
  | "settled"
  | "written_off"
  | "overpaid";

export type ReceivableSummary = {
  accountId: string;
  borrowerName: string;
  amountLent: number;
  amountRepaid: number;
  amountWrittenOff: number;
  outstanding: number;            // signed — NOT Math.abs'd
  lentOn: string | null;
  lastRepaymentOn: string | null;
  expectedRepaymentDate?: string;
  isOverdue: boolean;
  status: ReceivableStatus;
  daysSinceLastActivity: number;
};

export type LendingPortfolio = {
  totalLent: number;
  totalRepaid: number;
  totalWrittenOff: number;
  totalOutstanding: number;
  borrowers: ReceivableSummary[];  // overdue first, then largest outstanding
};

export function getReceivableSummary(
  account: Account,
  transactions: Transaction[],
  asOf: Date,
): ReceivableSummary | null;

export function getLendingPortfolio(
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
): LendingPortfolio;
```

Two deliberate departures from `debt.ts`:

- **`outstanding` is signed.** An overpayment surfaces as `status: "overpaid"`
  instead of being absorbed by `Math.abs`.
- **`asOf` is a parameter.** `debt.ts` calls `new Date()` inside `monthsBetween`
  ([debt.ts:47](../../../lib/domain/debt.ts)), which makes it impure and
  time-dependent to test. This module takes the clock as an argument.

`isOverdue` is true only when `expectedRepaymentDate` is set and `asOf` is past
it. There is no interest, no inferred minimum payment, no payoff plan, and no
snowball/avalanche ordering.

### Field derivation

All sums are over transactions where `accountId` matches the receivable.

| Field | Derivation |
|---|---|
| `amountLent` | Σ `amount` of `transfer` legs where `amount > 0` (money into the receivable) |
| `amountRepaid` | Σ \|`amount`\| of `transfer` legs where `amount < 0` |
| `amountWrittenOff` | Σ \|`amount`\| of `expense` transactions |
| `outstanding` | `account.balance`, unmodified |
| `lentOn` | earliest `occurredOn` among positive transfer legs, else `null` |
| `lastRepaymentOn` | latest `occurredOn` among negative transfer legs, else `null` |
| `daysSinceLastActivity` | whole days from the latest `occurredOn` of **any** transaction on the account to `asOf`; `0` when the account has none |

`amountLent` counts the opening balance too: a receivable opened with a positive
`openingBalance` represents money already owed before the app was in use, so
`amountLent` is the opening balance plus the positive transfer legs.

### Status derivation

Evaluated in order, against a module-local `BALANCE_EPSILON = 0.01`. The
constant is declared in `lending.ts`, not imported — the module imports nothing
from `debt.ts`.

1. `overpaid` — `outstanding < -BALANCE_EPSILON`
2. `written_off` — `|outstanding| <= BALANCE_EPSILON` and `amountWrittenOff > 0`
3. `settled` — `|outstanding| <= BALANCE_EPSILON`
4. `outstanding` — otherwise

A partial write-off that leaves a balance is `outstanding`, not `written_off`.

## UI

### `/debt` — extended to both directions

The page currently holds a `PageHeader` and the payoff planner, which the
[IA review](../../product/information-architecture-review.md) flags as thin.
It gains an **"Owed to you"** band: total outstanding, then the borrower list
sorted overdue-first, then by largest outstanding.

No new route, so `APP_SHELL_URLS` in `public/sw.js` and the nav registry in
`lib/data.ts` are untouched.

### Account form

A `receivable` branch: borrower name, amount lent, optional expected repayment
date. Follows the onboarding mobile treatment — 44px controls, no card padding
stacked on the app shell's gutter.

### Other touch points

- [account-list.tsx:121](../../../components/accounts/account-list.tsx) — add a
  receivable branch beside the existing debt one.
- `getAccountTotals` — its `Record<Account["type"], number>` produces a compile
  error that forces the new key. The type system does this discovery for us.
- `defaults.ts` — add `"receivable"` to `defaultAccountTypes`; seed two expense
  categories, **"Tips"** and **"Money written off"**.

### Deliberately unchanged

`insights.ts:94`, `repair-accounts-panel.tsx:44`, and
`account-balance-breakdown.tsx` all flag negative balances on non-debt accounts.
A negative receivable balance *is* a data error worth flagging, so the existing
behaviour is already correct for the new type.

`csv-import-utils.ts:70` branches on transaction type, not account type. We add
no transaction types, so it is untouched.

## Verification

Extended in `lib/domain/accounting.property.test.ts` rather than tested in
isolation — the point is that lending does not break existing identities.

1. **Lending preserves net worth.** A lending transfer pair leaves the sum of
   balances across the source and receivable accounts unchanged.
2. **Lending is invisible to the savings rate.** Inserting lending pairs into a
   transaction set changes neither `inflow`, `outflow`, nor `getSavingsRate`.
3. **Write-off is exact.** A write-off reduces total balance by exactly its
   amount and increases `outflow` by exactly its amount.

`lib/domain/lending.test.ts` covers status transitions, overdue detection
against a fixed `asOf`, the overpaid case, and empty-portfolio behaviour.

## Out of scope

- Interest on receivables.
- Any inferred repayment schedule or expected clear date.
- Payoff-strategy ordering for receivables.
- A `counterparty` field or concept.
- A `/lending` route.
- A "Gifts & family" category — already covered by existing seeds.

## Known risk

Net worth now includes receivables that may never be collected. This is correct
accounting, but the headline total becomes less liquid. A liquid-vs-total split
is **not** being built now; surfacing `totalOutstanding` on the `/debt` band
keeps the figure visible rather than buried inside one number.

---

## Revision: pooling

The account-per-borrower model above was built and then revised. One account per
loan proved too heavy: lending to five people created five accounts sitting
beside real institutions in the account list.

**What changed**

- Loans land by default in one shared pool account,
  `LENDING_POOL_ACCOUNT_ID` (`"account:money-lent-out"`), and the borrower is
  carried in the transaction's `payee`. Lending to five people creates one
  account.
- The pool is **not** seeded at bootstrap. It is offered as a transfer
  destination before it exists, and `ensureLendingPool` materialises it on the
  first loan, so people who never lend never see a lending account.
- A borrower who needs their own ledger can still have a dedicated receivable
  account. Both shapes report through `getLendingPortfolio`, which groups on a
  borrower key: the account for a dedicated one, the lowercased payee for a
  pooled one.
- `expectedRepaymentDate` **moved from `Account` to `Transaction`**, set on the
  leg that lands in the receivable. On the account it would only have worked for
  dedicated borrowers, and overdue tracking was half the feature's value.
- `getReceivableSummary` and the per-account panel
  (`components/accounts/receivable-summary.tsx`) were removed. The band on
  `/debt` is the single home for per-borrower detail.

**New invariant, property-tested**

Every borrower's `outstanding` must sum to the pool account's reconciled
balance. Otherwise the band shows per-borrower figures that do not add up to the
account they all live in. The arbitrary generates write-offs as well as loans
and repayments — without them the invariant holds even when the write-off maths
is broken, which was verified by mutation.

**Still open**

- `/debt` was renamed "Money owed" (page title and nav label) so the page is not
  called "Debt payoff" while showing receivables.
- Migration is not needed for lending: no user had a receivable before this
  shipped.
