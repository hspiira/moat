# Balance-gap detection — design

**Date:** 2026-07-25
**Status:** Approved (design), autonomous implementation authorized
**Scope owner:** Henry Piira
**Follows:** [2026-07-25-capture-fee-extraction-design.md](2026-07-25-capture-fee-extraction-design.md)

## Problem

Banks like Centenary charge fees that never appear in the SMS — only the resulting
`Bal:` is printed. A `−100,000` message that leaves the balance 2,875 lower than
expected hides a 2,875 charge. We can recover it because the message states the
balance: the delta between two stated-balance checkpoints, minus the transactions we
recorded between them, is the unrecorded money (almost always a fee).

## Decision

Capture the stated balance from every message that prints one; compute the gap
between consecutive checkpoints using a **delta-based** method (independent of
opening-balance calibration); and when approving a captured message whose stated
balance implies a shortfall, offer a one-tap **"Add as fee"** that prefills the
existing `feeAmount` field — reusing the entire capture-fee path.

## Design

### 1. Capture the stated balance

`parseStatedBalance(text): number | undefined` (in `lib/capture/normalizers.ts`)
matches the first balance token:
`/\b(?:new\s+balance|balance|bal)\b\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/i`.
Covers MTN `New balance: X`, Airtel `Bal/Balance UGX X`, Centenary `Bal:X`.
Absa prints none → `undefined`.

The pipeline sets `candidate.statedBalance = parseStatedBalance(rawText)` (one place,
all providers). A `statedBalance?: number` field is added to `CapturePipelineCandidate`,
`CaptureReviewItem`, `CaptureReviewSnapshot`, and `Transaction`. The review-item
factory and the transaction factory carry it through, so approved transactions retain
the checkpoint.

### 2. Gap math (pure, testable) — `lib/domain/balance-gap.ts`

```ts
type BalanceGap = { transactionId: string; gap: number; statedBalance: number; expectedBalance: number };
function detectBalanceGaps(transactions: Transaction[]): BalanceGap[];
```

For one account's transactions, sorted by `occurredOn` then `createdAt`, walk the
list accumulating `getTransactionBalanceDelta` since the last checkpoint. At each
transaction that carries a `statedBalance`:

```
expectedΔ = accumulated deltas since previous checkpoint (incl. this txn)
actualΔ   = statedBalance − previousStatedBalance
gap       = actualΔ − expectedΔ
```

Record a `BalanceGap` when `|gap| ≥ 1` (UGX tolerance). A **negative** gap = money
missing = a suspected fee of `|gap|`. A **positive** gap = extra money = an uncaptured
credit, not a fee. The first checkpoint only anchors (no prior → no gap). No
opening-balance dependency.

**Verified against real data:** prev checkpoint 1,791,819; message `−100,000`,
stated 1,688,944 → expectedΔ −100,000, actualΔ −102,875, gap **−2,875**.

### 3. Surface + resolve in the review queue

The review workspace already loads ledger `transactions`; pass them to
`CaptureReviewQueue` as a new `transactions` prop. A helper builds a synthetic
transaction from the pending item (its `type`, `normalizedAmount`, `statedBalance`),
appends it to the account's ledger transactions, runs `detectBalanceGaps`, and reads
the gap for the item's id.

When a **negative** gap exists, `ReviewItemEditor` shows a one-line hint above the
actions:
> *"Bank balance is UGX 2,875 lower than recorded — likely an unrecorded fee."*
> **[Add as fee]**

**Add as fee** sets `draft.feeAmount = |gap|` (added to any already-parsed fee is out
of scope — it replaces, since a stated fee and a balance gap are mutually exclusive in
practice). Approving then creates the linked "Fees & charges" expense through the
existing path — no new fee-creation code. A positive gap shows an informational note
only ("balance is higher than recorded — an uncaptured credit?"), no fee button.

## Testing

- `parseStatedBalance`: MTN/Airtel/Centenary extract the right number; Absa → undefined.
- `detectBalanceGaps`: the Centenary −2,875 case; a clean reconciling chain → no gaps;
  a single checkpoint → no gaps; a positive gap surfaces with positive sign.
- Pipeline carries `statedBalance` onto the candidate.
- Review-item factory + transaction factory carry `statedBalance`.

## Success criteria

- Approving the second Centenary message surfaces "UGX 2,875 lower — Add as fee", and
  tapping it prefills the fee so approval books a 2,875 "Fees & charges" expense.
- `tsc`, `lint`, `test`, `build` green.

## Out of scope / limits

- Needs ≥2 stated-balance captures per account (first anchors).
- Only as good as capture completeness — the resolve step always allows "it was
  another transaction" (dismiss) rather than silently booking a fee.
- Absa (no stated balance) cannot participate.
- Combining a parsed fee *and* a balance gap on the same message (they don't co-occur).
