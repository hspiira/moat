# Capture fee extraction — design

**Date:** 2026-07-25
**Status:** Approved (design), pending implementation plan
**Scope owner:** Henry Piira
**Follows:** [2026-07-25-transaction-fees-design.md](2026-07-25-transaction-fees-design.md) (v1 manual fees — shipped)

## Problem

v1 lets users record fees manually. But the whole point of capture is to avoid
manual entry: a pasted/shared/SMS mobile-money message already states its fee. The
parsers currently drop it — they extract only the principal amount — so a captured
`UGX 50,000` send that actually cost `51,250` still under-records by the fee, and
the user has to notice and re-add it by hand. This closes that gap: extract the fee
from the message, carry it through review, and materialize it as the linked fee
expense on approve.

## Decision

Extract a `feeAmount` in the parser, carry it through the existing capture pipeline
(candidate → review item → editor → approve), and on approve reuse the **v1**
`buildFeeTransaction` + `buildFeesCategory` helpers to create the linked fee. The
fee is **editable in the review queue** (prefilled from the parse) so a mis-parse is
correctable, not silently wrong. "Fee" means the **sum of all charge lines** —
`Fee` + `Tax` + `Charge` + `Excise duty` — because a Ugandan MoMo withdrawal shows
them as separate lines that together are the real cost.

## Design

Five hops, each carrying an optional `feeAmount?: number` (UGX):

### 1. Parser (`lib/capture/providers/*`)

- Add `feeAmount?: number` to `CaptureProviderResult` (`lib/capture/types.ts`).
- New shared helper in `lib/capture/providers/shared.ts`:

  ```ts
  export function parseCaptureFee(text: string): number | undefined
  ```

  Scans the whole message for charge lines and returns their **sum**, or
  `undefined` when none are found. Regex matches `fee` / `tax` / `charge` /
  `excise duty` optionally followed by a currency token and an amount:
  `/(?:excise\s+duty|fee|tax|charge)s?\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/gi`,
  summing every match via the existing `parseAmount`.

- MTN, Airtel, and generic-bank parsers set `feeAmount: parseCaptureFee(text)` on
  their **outgoing/debited** (expense) results. Incoming/credited (income) results
  do not extract a fee (receiving money is free). Fee extraction is independent of
  the amount/payee regexes, so the principal is unaffected.

### 2. Pipeline (`lib/capture/pipeline.ts`)

Carry `providerResult?.feeAmount` onto `CapturePipelineCandidate.feeAmount`
(add the field to `CapturePipelineCandidate` in `lib/capture/types.ts`).

### 3. Review item (`lib/types.ts`, `lib/capture/review-item-factory.ts`)

Add `feeAmount?: number` to `CaptureReviewItem` and `CaptureReviewSnapshot`.
`createCaptureReviewItem` copies `candidate.feeAmount` onto both the item and its
snapshot.

### 4. Review-queue editor (`components/transactions/capture-review-queue.tsx`)

In `ReviewItemEditor`, add an editable **"Fee — charges & tax (UGX)"** `InputField`
bound to `draft.feeAmount` (shown when `draft.type === "expense"`), using the same
`setDraft` pattern as the amount/payee fields. Empty input → `undefined`.

### 5. Approve (`components/transactions/use-capture-review-workspace.ts`)

After `repositories.transactions.upsert(proposed)`, if `item.feeAmount` is a positive
number:

```ts
await repositories.categories.upsert(buildFeesCategory(profile.id));
const fee = buildFeeTransaction(proposed, String(item.feeAmount), FEES_CATEGORY_ID);
if (fee) await repositories.transactions.upsert(fee);
```

The correction-log `approvedSnapshot` includes `feeAmount` for parser-refinement
telemetry.

### No new cascade

The fee transaction is born only at approve. If that approved payment is later
deleted from the ledger, the **v1** `feeParentId` delete-cascade already removes its
fee. Rejecting/duplicating a review item never created a fee, so nothing to clean up.

## Testing

- `lib/capture/providers/*.test.ts` (or `message-parser.test.ts`): an MTN outgoing
  message with `Fee UGX 1,000. Tax UGX 250` → `feeAmount === 1250`; an incoming
  message → `feeAmount` undefined; a message with no charge lines → undefined.
- `parseCaptureFee` unit tests: single fee, fee+tax+excise summed, none.
- `lib/capture/pipeline.test.ts`: candidate carries `feeAmount` from the provider.
- Approve path: approving an item with `feeAmount` writes two transactions — the
  payment and a linked `` `${paymentId}:fee` `` expense in the fees category.

## Success criteria

- Pasting an MTN withdrawal SMS with a fee produces a review item whose fee is
  prefilled; approving it records both the payment and the fee, and the account
  balance reflects the full cost.
- `tsc --noEmit`, `lint`, `test`, `build` all green.
- Principal-amount extraction is unchanged (no regressions in existing parser tests).

## Out of scope

- Payee-quality improvements for multi-clause SMS (pre-existing; unrelated).
- Non-expense fees (income never carries a fee here).
