# Moat — Data Integrity Plan

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Implementation plan (not started) |
| Owner | Piira |
| Last Updated | 2026-08-17 |
| Scope | Money representation, unbalanced savings, party identity, migration safety |

Status claims live in [tracker.md](../tracker.md).

## Order

1. Migration safety, because everything below migrates data.
2. Money representation, because every other number is measured against it.
3. Savings contributions, which are unbalanced.
4. Party identity, the largest and least urgent.

## 1. Migration safety

Two gaps, both established.

**No backup gate.** Opting into sync runs `migrateIdsToCuid2` across every
record with no backup taken. Until 2026-08-17 the backup was incomplete anyway,
so this was worse than it looked.

**Not resumable.** The migration writes replacements before deleting originals,
so an interruption leaves duplicates rather than gaps. But `alreadyMigrated`
returns false on a mixed state, so the next attempt renumbers again — and for
seeded records the old-format copy and the already-derived copy both derive the
same id, tripping the collision guard. The device is then stuck half-migrated,
with duplicated money, and the migration refusing to repair it.

Fix:

- Require a backup newer than the last write before the migration runs. Store
  its timestamp on the sync profile. Refuse rather than warn.
- Make `alreadyMigrated` per record, not all-or-nothing. A record whose id is
  already a valid cuid2 is done. A record whose migrated twin already exists is
  a leftover to delete, not a record to renumber.
- Write a resume marker before the first write and clear it after the last, so
  an interrupted run is identifiable rather than inferred from id shapes.

**Terrible scenarios**

| Scenario | Handling |
| --- | --- |
| Interrupted, re-run | Per-record detection; leftovers dropped, not renumbered |
| Interrupted, user restores instead | Backup gate guarantees one exists |
| Two tabs migrate at once | Take a lock record first; second tab refuses |
| Backup is from before recent edits | Gate compares backup time against the newest `updatedAt` |
| Migration runs after a sync | Already refused; keep the guard |

## 2. Money representation

### What is actually wrong

Amounts are JS floats. The live ledger holds `69056.189999836`,
`22174.000000164`, and an opening balance of `1110.19`. Floating point
accumulates error across additions, and it is unfit for money for exactly this
reason ([Modern Treasury](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents),
[Atomic Object](https://spin.atomicobject.com/currency-rounding-errors/),
[Sergio Lema](https://sergiolema.dev/2026/06/01/why-you-should-never-use-floating-point-for-money/)).

Two sources in this codebase:

- `normalizeAmountToUgx` returns `Math.abs(originalAmount) * rate` unrounded.
  `5.49 × 4038.9799636` is where `22174.000000164` came from.
- Nothing enforces an integer on input, so `1110.19` was accepted as an opening
  balance in a currency that has no fractional unit.

**`formatMoney` hides it.** UGX renders with `maximumFractionDigits: 0`, so the
drift is invisible on screen while present in storage and in every sum. A user
reconciling against a bank statement sees agreement while the ledger diverges.

### The design, and why it is smaller than it looks

UGX has an ISO 4217 exponent of **0**. It has had no subdivision since 2013
([Wikipedia](https://en.wikipedia.org/wiki/Ugandan_shilling),
[ExchangeRate](https://www.exchangerate.com/currency-iso/shilling-UGX.html)).

That matters, because the usual advice — "store cents" — is wrong for the
primary currency here. `Transaction.amount` is *always* UGX, already normalized.
So:

- **`amount`**: an integer number of shillings. A JS number is exact for
  integers to 2^53, which is far beyond any shilling balance. No type change,
  no library, no 120-file rewrite. The work is enforcing the invariant and
  rounding at the boundaries.
- **`originalAmount`**: in `currency`, so it needs that currency's exponent.
  Store integer minor units and record the exponent used.
- **`fxRateToUgx`**: a rate, not money. Bound its precision (6 decimals) rather
  than treating it as an amount.

Verify each supported currency's exponent against ISO 4217 before coding. USD,
EUR and GBP are 2. I have confirmed UGX is 0 and have **not** confirmed KES,
TZS or RWF; do not assume.

### Boundaries that must round

- `normalizeAmountToUgx`, on the FX product.
- `parseAmountInput`, on user entry.
- Capture and CSV import, on parsed amounts.
- The debt split. It already rounds interest and gives principal the remainder,
  so the parts sum to the payment. Keep that shape.
- Fee extraction.

One rounding function, one direction, used everywhere. Half-up on the absolute
value, so a sign never changes the result.

### Migration

Convert stored amounts to integers. Record every adjustment rather than
absorbing it: a per-account `roundingAdjustment` written as a visible
transaction, or a report the user acknowledges. Silently moving Airtel by 0.19
is how a ledger stops being trustworthy.

### Terrible scenarios

| Scenario | Handling |
| --- | --- |
| Rounding changes an account balance | Emit an explicit adjustment; never silent |
| Migration and runtime round differently | One shared function, no local `Math.round` |
| Round-then-sum ≠ sum-then-round on splits | Largest-remainder: parts must sum to the whole |
| Old backup restored after migration | Restore runs the same normalization |
| Sync sends a float from an unmigrated device | Server rejects non-integer `amount` |
| Rounding a foreign amount breaks statement reconciliation | Keep `originalAmount` exact in its own minor units; round only the UGX figure |
| `statedBalance` from an SMS is fractional | Round on capture, flag if it was not already whole |
| Drift already in the data is treated as a real gap | `TOLERANCE = 1` absorbs sub-shilling noise today; recheck after conversion |

`BALANCE_EPSILON = 0.01` in `lib/domain/debt.ts` exists precisely because of
float imprecision. Once amounts are integers it should go, and its absence
becomes a test.

## 3. Savings contributions have no destination

A `savings_contribution` reduces its account and nothing gains it. In the live
ledger 504,000 of insurance premiums left Absa, count as neither spending nor an
asset, and never reach the goal — which is linked to a different account. The
money is invisible in net worth.

A transfer is a balanced pair. A savings contribution is a single row. That is
the inconsistency.

Two coherent models, and this is a product decision before an engineering one:

- **It is spending.** A protection premium buys cover, not an asset. Then it is
  an expense with a category, and `savings_contribution` disappears.
- **It is a transfer to an asset.** Then it needs a destination account, and
  every existing row needs one assigned.

Recommend supporting both, because both occur: term life is an expense, an
endowment or a SACCO deposit is a transfer. Which one applies is a property of
the destination, so requiring a destination answers it.

### Terrible scenarios

| Scenario | Handling |
| --- | --- |
| Migration invents a destination account | Never. Ask, or leave as expense |
| Reclassifying changes historical net worth | Show the before and after and require confirmation |
| Goal progress changes retroactively | Expected; state it plainly |
| A row is converted to a transfer with no partner | Build both legs or do not convert |

## 4. Party identity

Identity is expressed three ways on a transaction: `payee`, `rawPayee`, and
`counterpartyId`. The counterparty entity exists only for lending and borrowing,
so "Kirkman" as a boda payee and "Kirkman" as a borrower are unrelated records.
That is what allowed one person to become four, and merging is a repair, not a
fix.

The fix is one identity, with `payee` a view of it. It is also the largest
change here and the least urgent, so it goes last.

### Terrible scenarios

| Scenario | Handling |
| --- | --- |
| A counterparty per payee | Never auto-promote free text. Every boda guy would become a party |
| Two real people share a name | Merge only on exact normalized match, which is the rule already applied; make merges visible and reversible |
| Merging loses a phone or note | Already handled in `planCounterpartyMerge` |
| Historical `rawPayee` is destroyed | Keep it. It is the parser's raw output and evidence |

## Cross-cutting

**Every step above migrates data, and the app has no transaction spanning
stores.** The adapter exposes per-record writes only. Until that changes, every
migration follows the same shape: build and validate everything, write, then
delete, and be resumable. Adding a real multi-store transaction to the
IndexedDB adapter would remove a whole class of these problems and is worth
costing.

**No UI test coverage.** Both mobile faults fixed on 2026-08-17 were invisible
to a green suite. Every item here changes numbers a user reads. A small set of
Playwright journeys should land before the money migration, not after.
