# Transaction fees & charges — design

**Date:** 2026-07-25
**Status:** Approved (design), pending implementation plan
**Scope owner:** Henry Piira

## Problem

Ugandan money movement almost always carries a fee: mobile-money sends and
withdrawals, plus bank charges and the 0.5% excise/tax lines. Moat currently has
**no concept of a fee**:

- No `fee`/`charge` field anywhere in the transaction model (`lib/types.ts`).
- The MoMo/bank parsers (`lib/capture/providers/*`) extract only the principal
  amount, payee and date — they silently drop the `Fee`/`Tax`/`Charge` lines.
- The manual transaction form has no fee input.

Consequence: a `UGX 50,000` send that actually cost `UGX 51,250` is recorded as
`50,000`, so account balances drift by the fee amount and "how much did I lose to
charges" is unanswerable. This is a data-correctness gap, not just a convenience
one.

## Decision

Record a fee as a **separate, linked expense transaction** — chosen over a
`feeAmount` field on the parent — because:

- Balances and spending reports are automatically correct: a fee is just a normal
  expense flowing through the existing expense path. No consumer of `amount` needs
  new math.
- "Total fees this month" is a plain category aggregation.
- It reuses the codebase's existing linked-transaction precedent (transfer pairs).

Trade-off accepted: a fee-bearing payment shows as **two ledger rows** (the
payment + its fee).

## Design

### Data model (`lib/types.ts`)

One new optional field on `Transaction`:

```ts
feeParentId?: string; // set on a fee expense; points at the payment it belongs to
```

A fee is an ordinary transaction with:

- `type: "expense"`
- `categoryId`: the canonical fees category (see below)
- `feeParentId`: the parent payment's id
- deterministic `id`: `` `${parentId}:fee` `` — mirrors the transfer pair's
  `` `${groupId}:source` `` so edits upsert in place and deletes are derivable.
- inherited from the parent: `accountId`, `currency`, `fxRateToUgx`, `occurredOn`,
  `userId`.

The parent payment gains **no** field — the link is one-directional (fee → parent),
and the fee id is derivable from the parent id, so cascade needs no back-reference.

### Fees category (`lib/app-state/defaults.ts`)

Rename the existing `"Mobile money charges"` seed to **`"Fees & charges"`** (id
becomes `category:fees-charges`, `kind: "expense"`) so there is one canonical,
provider-neutral fees category (covers MoMo *and* bank charges).

The fee-build step **upserts** `category:fees-charges` by its fixed id inside the
same write batch, so it exists for both new and existing installs without a
separate migration.

> **Existing-user note:** installs seeded before this change already have
> `category:mobile-money-charges`. They keep it as a normal user category (their
> historical data is untouched); new fees route to the new `category:fees-charges`.
> A user who wants to consolidate can recategorize/hide the old one. This is
> non-destructive and deliberate — no data migration is performed.

### Builder (`components/transactions/transaction-builder.ts`)

`buildManualTransaction` returns `Transaction[]` instead of a single `Transaction`:
`[payment]`, or `[payment, fee]` when `form.feeAmount` is a positive number.

`buildTransferPair` returns `[source, destination]` or
`[source, destination, fee]`. The fee attaches to the **source** account (the
account the money leaves). The transfer pair still sums to zero; the fee is the
extra money that left the source.

A shared helper builds the fee record from a parent transaction + the raw fee input,
applying `validateAmount(raw, { allowZero: false })`. Blank/zero fee → no fee record.

Editing a payment re-runs the builder: a changed fee upserts `` `${parentId}:fee` ``;
a cleared fee means the fee id is absent from the rebuilt set and the persistence
layer deletes the orphaned fee (same reconciliation the workspace already does for
transfer groups). Fee rows are **not independently editable** — the ledger routes an
edit/tap on a fee row to its parent, so payment and fee cannot drift.

### Persistence / cascade (`components/transactions/use-transactions-workspace.ts`)

- **Save:** persist the full `Transaction[]` the builder returns (parent + optional
  fee), and when editing, delete any previously-existing `` `${parentId}:fee` `` that
  the rebuilt set no longer contains.
- **Delete:** deleting a payment cascades to `` `${parentId}:fee` `` — extend the
  existing cascade branch (currently keyed on `transferGroupId`, ~line 506) to also
  remove a transaction's linked fee.

### Form UX (`components/transactions/transaction-form.tsx`)

Add an optional **"Fee (charges & tax)"** amount input (`inputMode="decimal"`,
UGX) inside the existing collapsible details section — same placement and
auto-expand-when-present behavior as the FX field. Shown for `expense` and
`transfer` types only; hidden for `income`, `savings_contribution`, `debt_payment`
in v1. New form-state field `feeAmount: string` (default `""`).

### Scope

**In this plan (v1):** data model field, fees category rename + upsert, builder
(expense + transfer), manual form input, save/delete cascade, tests.

**Fast-follow (separate spec/plan):** teach `lib/capture/providers/*` (MTN, Airtel,
generic bank) to extract `Fee`/`Tax`/`Charge` and pre-fill the fee in the capture
review queue. Deferred because it lands in the parser + capture-review files under
active concurrent refactoring; doing it as its own pass avoids collisions.

## Testing

- `transaction-builder.test.ts`:
  - manual expense with a fee → returns `[payment, fee]`; fee has deterministic id
    `` `${parentId}:fee` ``, `type: "expense"`, fees category, parent's account &
    currency, `feeParentId` set.
  - transfer with a fee → `[source, destination, fee]`; pair still sums to zero; fee
    on the source account.
  - editing: fee raised → fee upserts same id; fee cleared → rebuilt set omits the
    fee id (drives deletion).
  - blank/zero fee → no fee record.
- A domain/summary test proving the fee reduces the account balance and counts as
  expense spending (should pass with no summary-code changes — the point is to prove
  the "no new math" claim).

## Success criteria

- Recording a `50,000` send with a `1,250` fee drops the account balance by
  `51,250` and shows a `1,250` "Fees & charges" expense.
- `tsc --noEmit`, `lint`, `test`, `build` all green.
- No changes required in balance/summary calculation code.
