# Capture inbox review, sections, resolved items, and transaction detail

Date: 2026-07-29
Status: approved for planning

## Problem

The capture inbox at `/transactions/review/capture` renders every review item as
the same editable form, whatever its status. That single decision produces most
of the page's defects:

1. **Re-approval writes duplicate ledger rows.** An approved item still shows an
   enabled "Approve to ledger" button. `buildTransactionFromCaptureReviewItem`
   mints a fresh `transaction:${crypto.randomUUID()}` on every call, so a second
   click creates a second, unrelated transaction for the same capture.

2. **Saving an approved item silently un-approves it.** `updateItem` recomputes
   `status` from scratch (`duplicate` → `needs_review` → `new`) and never
   consults the existing status or clears `approvedTransactionId`. An approved
   item edited by accident drops back into New while its ledger transaction
   stays behind, the second route to duplicate rows.

3. **Items are visually indistinguishable.** A row header shows payee, source,
   parser label, confidence and amount. It shows neither the date nor the
   account, so two captures from the same payee for the same amount look
   identical.

4. **Duplicates never say what they duplicate.** `duplicateTransactionId` and
   `duplicateCaptureReviewItemId` are persisted but never rendered. Worse,
   `markDuplicate` never sets either field, so a manually-marked duplicate has
   no link, fails to gain the "Likely duplicate" issue, and passes validation,
   it can be approved anyway. There is no way to undo the mark.

5. **"Resolved" hides a real distinction.** Approved and rejected items are
   filtered into one bucket and rendered identically.

6. **Fees are half-supported.** The fee input appears only for
   `type === "expense"`, though `debt_payment` and `savings_contribution` also
   debit an account and carry charges. After approval the fee is invisible in
   the review UI entirely.

7. **No way to inspect one transaction.** The ledger lists rows and offers
   edit/delete, but there is no read-only view of a single transaction, and a
   capture-created fee appears as a separate equal-weight row with no visible
   relationship to the payment it was charged against.

## Design

### Sections

Five explicit sections replace the current four filters, each showing its count:

| Section | Predicate | Interaction |
|---|---|---|
| New | `status === "new"` | Editable form |
| Needs review | `status === "needs_review"` | Editable form + issues |
| Duplicates | `status === "duplicate"` | Editable form + counterpart comparison |
| Approved | `status === "approved"` | Read-only row → detail sheet |
| Rejected | `status === "rejected"` | Read-only row → detail sheet |

The combined "Resolved" filter is removed. Approved and rejected are settled
outcomes and deserve to be told apart.

### Approved and Rejected presentation

Read-only compact rows, ordered newest first, in the shape:

```
Jul 24   Stanbic · MTN Airtime           −12,000   [fee 500]
Jul 24   Stanbic · Shoprite Lugogo       −86,400
Jul 23   Stanbic · Salary              +2,400,000
```

Date and account lead, which is what makes two similar captures separable at a
glance. A fee badge appears when `feeAmount > 0`. Amounts use the existing
`Money` component so sign and tone stay consistent with the ledger.

Tapping a row opens a right-side `Sheet` containing:

- identity line (date · account · category · type)
- amount, and the original-currency amount plus FX rate when currency ≠ UGX
- fee, when present
- source · parser label · confidence
- **what changed vs. the original capture**, a field-by-field diff of
  `originalSnapshot` against the item's current values
- the linked ledger transaction (for approved items), with its id and a link to
  the ledger
- issues and field warnings, as recorded at the time

Nothing in this sheet is editable. Approved items are records, not drafts.

### Duplicates

The Duplicates section keeps the editable form (a duplicate may still need
correcting before it is dismissed or approved) and adds a comparison panel
showing the counterpart resolved from `duplicateTransactionId` or
`duplicateCaptureReviewItemId`, same fields, side by side, so the user sees
what the match actually is.

A **"Not a duplicate"** action clears both link fields, drops the "Likely
duplicate" issue, and returns the item to `new` or `needs_review` depending on
whether other issues remain.

### Bug fixes in the workspace hook

In `components/transactions/use-capture-review-workspace.ts`:

- `approveItem` returns early with an explanatory error when
  `item.approvedTransactionId` is already set, or when `item.status` is
  `"approved"`. This is the direct guard against duplicate ledger rows.
- `updateItem` preserves `"approved"` and `"rejected"` status rather than
  recomputing it, and rejects edits to resolved items outright.
- `markDuplicate(item, counterpart)` records the counterpart id on the correct
  field and recomputes issues so `validateCaptureReviewItem` reports "Likely
  duplicate", which in turn blocks approval.
- `clearDuplicate(item)` is added for the "Not a duplicate" action.

### Transaction detail sheet

Tapping any row in the ledger at `/transactions` opens a read-only sheet:

```
Shoprite Lugogo                −86,400 UGX
Jul 24, 2026 · Stanbic · Groceries

Charges & tax                       −500
─────────────────────────────────────────
Total off account                −86,900

Source   SMS · centenary-uganda · 92%
Stated balance             1,240,300 UGX
```

The fee is resolved through the existing `feeParentId` link, so it works for
fees created by capture approval and by manual entry alike. Tapping a fee row
opens its **parent's** sheet, a fee is never a standalone subject. The sheet
also shows FX details when currency ≠ UGX, the reconciliation state, and the
matched rule when one applied.

Edit and Delete remain in the existing row popover; the sheet does not duplicate
them.

### Fees beyond expense

The fee input in the editor is shown for `expense`, `debt_payment` and
`savings_contribution`. `income` keeps no fee field. The approval path in the
hook already builds the fee transaction from `feeAmount` regardless of type, so
no change is needed there.

## Modules

Two new pure modules keep the logic testable and the components thin.

**`lib/domain/capture-review.ts`**

- `CaptureReviewSection` type and `captureReviewSections` ordered list
- `getSectionItems(items, section)`, section filtering
- `isCaptureItemEditable(item)`, false for `approved` and `rejected`
- `canApproveCaptureItem(item)`, false when already approved, when
  `approvedTransactionId` is set, or when issues remain
- `resolveDuplicateCounterpart(item, transactions, items)`, returns the linked
  transaction or sibling capture, or null
- `diffCaptureFromOriginal(item)`, `Array<{ field, from, to }>` comparing
  `originalSnapshot` to current values

**`lib/domain/transaction-detail.ts`**

- `getTransactionDetail(transaction, transactions)` → `{ subject, fee, parent,
  totalOffAccount }`. Given a parent, finds its fee child; given a fee, resolves
  and returns the parent as the subject.

## Components

| File | Change |
|---|---|
| `components/transactions/capture-review-queue.tsx` | Rewritten: section tabs with counts, dispatches to editor or row |
| `components/transactions/capture-review-item-editor.tsx` | New, the editable form extracted from the queue, with date+account in the header, wider fee support, and the duplicate counterpart panel |
| `components/transactions/capture-review-row.tsx` | New, compact read-only row |
| `components/transactions/capture-review-detail-sheet.tsx` | New, read-only capture record |
| `components/transactions/transaction-detail-sheet.tsx` | New, read-only transaction record with fee |
| `components/transactions/transaction-list.tsx` | Rows become clickable, opening the detail sheet |
| `components/transactions-ledger-workspace.tsx` | Holds the selected-transaction state for the sheet |
| `components/transactions/use-capture-review-workspace.ts` | The four hook fixes above |

Splitting the 265-line queue file is part of the fix, not incidental tidying:
one component deciding both "which fields are editable" and "which actions are
available" is what let approved items render as approvable forms.

## Data flow

Nothing changes in the persistence layer. `CaptureReviewItem` and `Transaction`
keep their current shape; the work is reading fields that are already stored
(`duplicateTransactionId`, `approvedTransactionId`, `originalSnapshot`,
`feeParentId`, `statedBalance`) and are currently ignored by the UI.

## Error handling

- Approving an already-approved item surfaces the existing `error` state on the
  workspace frame rather than throwing.
- A duplicate link pointing at a deleted transaction resolves to `null`; the
  comparison panel then reads "The matching record no longer exists" and offers
  "Not a duplicate".
- A fee whose parent has been deleted renders as a standalone row; the detail
  sheet shows it as its own subject with no parent line.

## Testing

New vitest suites, following the existing pure-module test convention:

- `lib/domain/capture-review.test.ts`, section filtering across all five
  statuses, `canApproveCaptureItem` false for approved and for items with
  issues, counterpart resolution for both link kinds and for dangling links,
  diff output for changed and unchanged fields.
- `lib/domain/transaction-detail.test.ts`, parent with fee, parent without fee,
  fee resolving to its parent, fee with a deleted parent, and
  `totalOffAccount` arithmetic.

Existing suites must continue to pass, in particular
`lib/capture/review-queue.test.ts` and
`components/transactions/transaction-builder.test.ts`.

## Out of scope

- The month-close review page at `/transactions/review`.
- Any change to parsers, the capture pipeline, or deduplication detection.
- Bulk actions on the inbox (approve-all, reject-all).
- Editing a transaction from the new detail sheet.
