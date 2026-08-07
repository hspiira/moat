# Purchase planner, line items, and price memory — design

**Date:** 2026-08-07
**Status:** Approved (design), pending implementation plan
**Scope owner:** Henry Piira

## Problem

Three connected gaps, in the user's words:

1. "I need to plan for a few items to buy, I need to track them" — there is no
   place to hold *intended* spending. Goals hold savings targets and budgets hold
   category ceilings, but "buy sugar, a mattress, and school shoes before the
   15th" lives outside Moat.
2. "I got groceries but not sure how much I spent on each" — a transaction is a
   single amount. A `UGX 60,000` supermarket run cannot be itemized, so
   category-level truth stops at "Food: 60,000" and per-item knowledge is lost.
3. "It could also guide on where to go for cheaper items" — with no item-level
   history, Moat cannot answer "where was sugar cheapest?"

The existing roadmap ([roadmap-and-opportunities.md](../../research/roadmap-and-opportunities.md))
already lists **split transactions** and receipt attachments under Phase 5;
this design delivers the split half now and adds the planner and price memory
that make splits worth entering.

## Decision

Build the three features as **one connected loop** rather than three modules:

> planned purchase (shopping todo) → checked off against a transaction line
> item (the split) → line items joined with the transaction's payee/date become
> price observations → observations surface back in the planner as guidance.

Key choices, each chosen over its alternative:

- **Item catalog via autocomplete**, not free text and not upfront cataloging.
  An `Item` row is created implicitly the first time a normalized name is used.
  Free text ("Sugar 1kg" / "sugar" / "Kakira sugar") would fragment price
  history; an explicit catalog UI would be entry friction nobody asked for.
- **Informal itemization**, not strict splits. Line-item amounts are optional
  and never blocked on summing to the transaction amount. The UI shows
  "itemized 41,500 of 60,000 — 18,500 unitemized". This matches the actual
  input situation (a crumpled receipt, a half-remembered basket).
- **Price observations are derived, not stored.** A pure domain function joins
  line items with their parent transaction (`payee` = merchant, `occurredOn` =
  date, `unitPrice`/`amount` = price). No new sync entity, nothing to keep
  consistent, and guidance automatically reflects edits and deletes.
- **Price knowledge comes from the user's own history only.** External or
  community price data would require a hosted service and conflicts with the
  local-first posture; it stays out of scope. The pattern is the classic
  "personal price book" (Assay, PricePad, AnyList).

## Design

### Data model (`lib/types.ts`)

Three new entities, following the existing shape (id, userId, ISO timestamps):

```ts
export type Item = {
  id: string;
  userId: string;
  name: string;            // display name, e.g. "Sugar (1kg)"
  normalizedName: string;  // lowercased/trimmed match key
  unit?: string;           // "kg", "litre", "piece" — free text
  defaultCategoryId?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlannedPurchaseStatus = "planned" | "purchased" | "dropped";

export type PlannedPurchase = {
  id: string;
  userId: string;
  itemId: string;
  quantity?: number;
  estimatedUnitPrice?: number; // UGX
  neededBy?: string;           // ISO date
  note?: string;
  status: PlannedPurchaseStatus;
  linkedTransactionId?: string; // set when purchased
  linkedLineItemId?: string;    // set when purchased
  createdAt: string;
  updatedAt: string;
};

export type TransactionLineItem = {
  id: string;
  userId: string;
  transactionId: string;
  itemId?: string;      // optional: a line can stay unmatched free text
  label: string;        // raw text as entered / future OCR output
  quantity?: number;
  unitPrice?: number;   // UGX
  amount?: number;      // UGX; quantity × unitPrice when both present
  categoryId?: string;  // optional per-item category
  plannedPurchaseId?: string; // back-link when fulfilling a plan
  createdAt: string;
  updatedAt: string;
};
```

Derived (domain functions, not stored):

```ts
export type PriceObservation = {
  itemId: string;
  transactionId: string;
  lineItemId: string;
  merchant: string;   // transaction.payee ?? "Unknown"
  occurredOn: string;
  unitPrice?: number;
  amount?: number;
  quantity?: number;
};

export type ItemPriceSummary = {
  itemId: string;
  lastPaid?: PriceObservation;
  bestRecent?: PriceObservation; // lowest unitPrice (fallback amount) in last 12 months
  observationCount: number;
};
```

### Repositories (`lib/repositories/`)

Three new stores registered the same way as existing entities, wired into
`RepositoryBundle`, IndexedDB schema migration, and the sync outbox
(`entityType`: `"item"`, `"planned_purchase"`, `"transaction_line_item"`):

- `ItemRepository extends Repository<Item>` with `findByNormalizedName(name)`.
- `PlannedPurchaseRepository extends Repository<PlannedPurchase>` with
  `listByStatus(status)`.
- `TransactionLineItemRepository extends Repository<TransactionLineItem>` with
  `listByTransactionId(id)` and `listByItemId(id)`.

### Domain (`lib/domain/`)

Pure, unit-tested modules:

- `item-normalization.ts` — `normalizeItemName(raw)`: trim, collapse
  whitespace, lowercase. Resolution: exact normalized match reuses the Item;
  otherwise create. (No fuzzy matching in v1; renaming/merging items is a
  later admin affordance.)
- `line-items.ts` — `summarizeItemization(transaction, lineItems)` returns
  itemized total, unitemized remainder, and per-line derived amounts
  (`quantity × unitPrice` when `amount` absent). Never negative UI math:
  over-itemization is reported as `overItemizedBy` rather than clamped.
- `price-observations.ts` — `derivePriceObservations(lineItems, transactions)`
  and `summarizeItemPrices(observations)` producing `ItemPriceSummary` per
  item (last paid, best recent within 12 months, count).
- `planned-purchases.ts` — list total estimation
  (`Σ (quantity ?? 1) × estimatedUnitPrice` over `planned` rows, missing
  estimates counted as 0 and surfaced as "n items unestimated"), fulfillment
  transitions,
  and un-fulfillment (see lifecycle below).

### Lifecycle rules

- **Fulfilling**: checking off planned purchases against a transaction writes
  one `TransactionLineItem` per purchase (label from item name, quantity and
  unitPrice prefilled from estimates, `plannedPurchaseId` set), then marks each
  `PlannedPurchase` as `purchased` with both links set.
- **Transaction deleted** → its line items are deleted in the same operation;
  any planned purchases linked to those line items revert to `planned` with
  links cleared. (Same cascade discipline as transfer pairs / fee children.)
- **Line item deleted** → linked planned purchase reverts to `planned`.
- **Planned purchase dropped** → row kept with `status: "dropped"` (history),
  hidden from the active list.
- **Item archived** → hidden from autocomplete; history remains intact.

### UI

- **New route `/shopping`** with a nav entry — the planner.
  - Add row: item autocomplete (against non-archived Items; free text creates),
    optional quantity, estimated price, needed-by date, note.
  - Each row shows price memory when it exists, e.g.
    `last 3,500 @ Mega Standard · best 2,800 @ Owino (Jun)`.
  - Header: estimated total of open items + "n unestimated".
  - Sections: overdue (`neededBy` past), upcoming, someday (no date).
    Purchased/dropped collapse into a history section.
  - **Check-off flow**: select bought rows → sheet offering
    (a) *attach to an existing transaction* — recent expenses, e.g. the MoMo
    capture that just posted — or (b) *record a new expense* prefilled with the
    estimate sum. Either path runs the fulfillment lifecycle above.
- **Transaction detail — "Items" section** on expense transactions: add/edit/
  delete line items (label with autocomplete, quantity, unit price, amount,
  optional category). Shows the itemization summary line
  (`itemized X of Y — Z unitemized`, or `over-itemized by Z`). Available on any
  expense, planner-linked or not.
- **Item history view**: tapping an item (planner row or line item) opens its
  purchase history — observations over time, per-merchant last/best price.
  This *is* the price guidance surface.
- **Accessibility constraint**: cheapest/priciest and overdue markers must use
  text and icons, never hue alone.

Existing form conventions apply: shadcn/ui components only, same field
components as the transaction form.

### Out of scope (explicitly)

- Receipt-OCR line-item extraction. The capture pipeline (tesseract/pdf.js)
  already produces raw text; a future parser can deposit rows into
  `TransactionLineItem.label` — the model is ready, the parser is not this
  project.
- Community/external price data, barcode scanning, unit-price conversion
  across pack sizes.
- Per-item budget reporting. Line-item `categoryId` is stored but budget math
  remains transaction-level in v1 (informal splits don't reconcile, so feeding
  them into budget aggregates would double-count or under-count).
- Multiple named shopping lists. One planner; `neededBy` + notes cover the
  pilot need. Revisit if real usage demands grouping.

### Testing

- Unit tests for every domain module above (normalization idempotence,
  itemization math incl. over-itemization, observation derivation, summary
  selection of last/best).
- Property-based tests (fast-check, matching existing accounting tests):
  itemized total + unitemized remainder ≡ transaction amount when not
  over-itemized; fulfillment then un-fulfillment round-trips a
  `PlannedPurchase` to its prior state.
- Repository tests against fake-indexeddb for the three new stores and the
  transaction-delete cascade.

## Backlog — what else Moat could track (research, not scope)

Ranked by leverage given data that already exists:

1. **Projected cash flow** — recurring obligations + salary cycle + balances
   already exist; project 30–90 days forward and flag shortfalls.
2. **Net worth statement over time** — accounts already carry balances incl.
   debt/receivable; add a monthly snapshot series.
3. **Subscription/recurring audit** — reframe recurring obligations with
   cost-per-year and cancel-candidate views.
4. **Sinking funds** — already on the roadmap; planner items with far-off
   `neededBy` dates are natural feeders.
5. **Later**: insurance policies/premiums, asset & warranty inventory,
   household shared-expense settlement on the counterparty ledger.
