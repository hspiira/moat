# Transaction Fees & Charges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users record mobile-money and bank fees so account balances stay correct, by attaching an optional fee to a transaction that is persisted as a separate linked "Fees & charges" expense.

**Architecture:** A fee is an ordinary `expense` transaction with a deterministic id `` `${parentId}:fee` `` and a `feeParentId` back-link, mirroring the existing transfer-pair pattern. Because a fee is just another expense, the existing balance/summary math (`getTransactionBalanceDelta`) handles it with no changes. The manual form gains an optional UGX fee input; save/edit/delete in the workspace hook create, upsert, or cascade-delete the linked fee.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Vitest, IndexedDB repositories.

## Global Constraints

- Commit with NO Claude affiliation: `git -c commit.gpgsign=false commit --no-verify -m "…"`. Author is Henry Piira.
- Gate every task: `npx tsc --noEmit && npm run lint && npm run test`. Run `npm run build` before the final commit.
- Fee is stored in **UGX only** (`currency: "UGX"`, no `fxRateToUgx`), MoMo/bank charges are always levied in UGX.
- Fee category is the canonical `category:fees-charges` ("Fees & charges", `kind: "expense"`).
- Do NOT run rules (`applyTransactionRules`) on a fee, it is a system-derived charge.
- Fee currently applies to `expense` and `transfer` types only. Income/savings/debt are out of scope for v1.
- Non-destructive: no migration of existing users' "Mobile money charges" category.

---

### Task 1: Data model field + canonical fees category

**Files:**
- Modify: `lib/types.ts` (Transaction type)
- Modify: `lib/app-state/defaults.ts` (rename seed, add id constant + builder)
- Test: `lib/app-state/defaults.test.ts` (create, or append if it exists)

**Interfaces:**
- Produces: `Transaction.feeParentId?: string`; `FEES_CATEGORY_ID = "category:fees-charges"`; `buildFeesCategory(userId: string): Category`.

- [ ] **Step 1: Write the failing test**

Create `lib/app-state/defaults.test.ts` (if the file exists, append the `describe` block):

```ts
import { describe, expect, it } from "vitest";

import {
  FEES_CATEGORY_ID,
  buildDefaultCategories,
  buildFeesCategory,
} from "./defaults";

describe("fees category", () => {
  it("exposes the canonical id and a well-formed expense category", () => {
    const fees = buildFeesCategory("user:1");
    expect(FEES_CATEGORY_ID).toBe("category:fees-charges");
    expect(fees.id).toBe(FEES_CATEGORY_ID);
    expect(fees.kind).toBe("expense");
    expect(fees.name).toBe("Fees & charges");
    expect(fees.userId).toBe("user:1");
  });

  it("seeds the canonical fees category by default (no separate MoMo-charges seed)", () => {
    const categories = buildDefaultCategories("user:1");
    expect(categories.some((c) => c.id === FEES_CATEGORY_ID)).toBe(true);
    expect(categories.some((c) => c.id === "category:mobile-money-charges")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/app-state/defaults.test.ts`
Expected: FAIL, `buildFeesCategory` / `FEES_CATEGORY_ID` not exported.

- [ ] **Step 3: Add `feeParentId` to the Transaction type**

In `lib/types.ts`, inside `export type Transaction = { … }`, add after `transferGroupId?: string;`:

```ts
  /** Set on a fee expense; points at the payment it was charged against. */
  feeParentId?: string;
```

- [ ] **Step 4: Rename the seed and add the fees-category exports**

In `lib/app-state/defaults.ts`, change the seed line:

```ts
  { name: "Mobile money charges", kind: "expense" },
```
to:
```ts
  { name: "Fees & charges", kind: "expense" },
```

Then add, directly above `buildDefaultCategories`:

```ts
export const FEES_CATEGORY_ID = "category:fees-charges";

export function buildFeesCategory(userId: string): Category {
  return {
    id: FEES_CATEGORY_ID,
    userId,
    name: "Fees & charges",
    kind: "expense",
    isDefault: true,
    createdAt: DEFAULT_DATE,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/app-state/defaults.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/types.ts lib/app-state/defaults.ts lib/app-state/defaults.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Add feeParentId field and canonical Fees & charges category"
```

---

### Task 2: `buildFeeTransaction` builder helper

**Files:**
- Modify: `components/transactions/transaction-builder.ts`
- Test: `components/transactions/transaction-builder.test.ts`

**Interfaces:**
- Consumes: `Transaction` (with `feeParentId`), `FEES_CATEGORY_ID` from Task 1.
- Produces: `buildFeeTransaction(parent: Transaction, feeAmountRaw: string, feesCategoryId: string): Transaction | null`, returns a UGX fee expense, or `null` when the raw input is blank / non-positive / non-finite.

- [ ] **Step 1: Write the failing test**

Append to `components/transactions/transaction-builder.test.ts`:

```ts
import { buildFeeTransaction } from "./transaction-builder";
import { FEES_CATEGORY_ID } from "@/lib/app-state/defaults";

const parentPayment: Transaction = {
  id: "transaction:abc",
  userId: "user:default",
  accountId: "account:momo",
  type: "expense",
  amount: 50_000,
  currency: "USD",
  originalAmount: 13,
  fxRateToUgx: 3846,
  occurredOn: "2026-04-10",
  categoryId: "category:food",
  reconciliationState: "posted",
  source: "manual",
  payee: "Mega Standard",
  createdAt: "2026-04-10T12:00:00.000Z",
  updatedAt: "2026-04-10T12:00:00.000Z",
};

describe("buildFeeTransaction", () => {
  it("builds a UGX fee expense linked to its parent with a deterministic id", () => {
    const fee = buildFeeTransaction(parentPayment, "1250", FEES_CATEGORY_ID);
    expect(fee).not.toBeNull();
    expect(fee!.id).toBe("transaction:abc:fee");
    expect(fee!.feeParentId).toBe("transaction:abc");
    expect(fee!.type).toBe("expense");
    expect(fee!.categoryId).toBe(FEES_CATEGORY_ID);
    expect(fee!.accountId).toBe("account:momo");
    expect(fee!.currency).toBe("UGX");
    expect(fee!.fxRateToUgx).toBeUndefined();
    expect(fee!.amount).toBe(1250);
    expect(fee!.originalAmount).toBe(1250);
    expect(fee!.occurredOn).toBe("2026-04-10");
    expect(fee!.createdAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("returns null for blank, zero, negative, or non-numeric fees", () => {
    expect(buildFeeTransaction(parentPayment, "", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "   ", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "0", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "-5", FEES_CATEGORY_ID)).toBeNull();
    expect(buildFeeTransaction(parentPayment, "abc", FEES_CATEGORY_ID)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/transactions/transaction-builder.test.ts`
Expected: FAIL, `buildFeeTransaction` not exported.

- [ ] **Step 3: Implement `buildFeeTransaction`**

Append to `components/transactions/transaction-builder.ts`:

```ts
/**
 * Builds the linked fee expense for a payment. The fee is always a UGX expense
 * in the fees category, sharing the parent's account and date, with a
 * deterministic id so edits upsert in place and deletes are derivable.
 * Returns null when no positive fee was entered.
 */
export function buildFeeTransaction(
  parent: Transaction,
  feeAmountRaw: string,
  feesCategoryId: string,
): Transaction | null {
  const value = Number(feeAmountRaw.trim());
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    id: `${parent.id}:fee`,
    userId: parent.userId,
    accountId: parent.accountId,
    type: "expense",
    amount: value,
    currency: "UGX",
    originalAmount: value,
    fxRateToUgx: undefined,
    occurredOn: parent.occurredOn,
    categoryId: feesCategoryId,
    reconciliationState: "posted",
    source: parent.source,
    payee: parent.payee,
    note: "Fee / charges",
    feeParentId: parent.id,
    reviewedAt: parent.updatedAt,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/transactions/transaction-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add components/transactions/transaction-builder.ts components/transactions/transaction-builder.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Add buildFeeTransaction helper for linked fee expenses"
```

---

### Task 3: Fee input on the transaction form + fee rows in the list

**Files:**
- Modify: `components/transactions/transaction-form.tsx` (state field, default, UI, `hasDetails`)
- Modify: `components/transactions/transaction-list.tsx` (hide Edit on fee rows)

**Interfaces:**
- Produces: `TransactionFormState.feeAmount: string` (default `""`); a fee `InputField` shown for `expense`/`transfer`.
- Consumes: `Transaction.feeParentId` from Task 1.

- [ ] **Step 1: Add `feeAmount` to the form-state type and default**

In `components/transactions/transaction-form.tsx`, add to `TransactionFormState` after `fxRateToUgx: string;`:

```ts
  feeAmount: string;
```

and to `defaultTransactionForm` after `fxRateToUgx: "",`:

```ts
  feeAmount: "",
```

- [ ] **Step 2: Include the fee in the auto-expand signal**

In the same file, update `hasDetails` (currently `Boolean(form.payee || form.note || form.currency !== "UGX")`) to:

```ts
  const hasDetails = Boolean(
    form.payee || form.note || form.currency !== "UGX" || form.feeAmount,
  );
```

- [ ] **Step 3: Add the fee input inside the details block**

In the `{detailsOpen ? (` details `<div>` (after the Currency `SelectField`, before the Note `TextareaField`), add:

```tsx
              {form.type === "expense" || form.type === "transfer" ? (
                <InputField
                  id="tx-fee"
                  label="Fee, charges & tax (UGX)"
                  inputMode="decimal"
                  value={form.feeAmount}
                  onChange={(e) => onFormChange((c) => ({ ...c, feeAmount: e.target.value }))}
                  placeholder="Optional, e.g. 1250"
                />
              ) : null}
```

- [ ] **Step 4: Mention the fee in the collapsed details prompt**

Update the collapsed button label so the fee is discoverable. Replace:

```tsx
              Add details, payee, note, currency
```
with:
```tsx
              {form.type === "expense" || form.type === "transfer"
                ? "Add details, fee, payee, note, currency"
                : "Add details, payee, note, currency"}
```

- [ ] **Step 5: Hide Edit on linked fee rows in the list**

In `components/transactions/transaction-list.tsx`, after `const isTransfer = transaction.type === "transfer";` add:

```tsx
              const isLinkedFee = Boolean(transaction.feeParentId);
```

Then change the Edit guard from `{!isTransfer ? (` to:

```tsx
                      {!isTransfer && !isLinkedFee ? (
```

- [ ] **Step 6: Gate + commit**

TypeScript proves the wiring; the fee input renders under Details for expense/transfer.

```bash
npx tsc --noEmit && npm run lint && npm run test
git add components/transactions/transaction-form.tsx components/transactions/transaction-list.tsx
git -c commit.gpgsign=false commit --no-verify -m "Add optional fee input to the transaction form"
```

---

### Task 4: Persist, edit, and cascade-delete the linked fee

**Files:**
- Modify: `components/transactions/use-transactions-workspace.ts` (save, edit-prefill, delete cascade)
- Test: `lib/domain/accounts.test.ts` (balance proof, the fee reduces the balance with no summary-code change)

**Interfaces:**
- Consumes: `buildFeeTransaction` (Task 2), `buildFeesCategory` + `FEES_CATEGORY_ID` (Task 1), `TransactionFormState.feeAmount` (Task 3), existing `repositories.transactions.upsert/remove` and `repositories.categories.upsert`.

- [ ] **Step 1: Write the failing balance test**

Append to `lib/domain/accounts.test.ts` (reuse its existing `account` fixture and `buildTransaction` helper):

```ts
describe("reconcileAccountBalances with a linked fee", () => {
  it("subtracts both the payment and its fee from the balance", () => {
    const transactions: Transaction[] = [
      buildTransaction({
        id: "transaction:send",
        accountId: account.id,
        type: "expense",
        amount: 50_000,
        occurredOn: "2026-04-06",
        categoryId: "category:food",
      }),
      buildTransaction({
        id: "transaction:send:fee",
        accountId: account.id,
        type: "expense",
        amount: 1_250,
        occurredOn: "2026-04-06",
        categoryId: "category:fees-charges",
        feeParentId: "transaction:send",
      }),
    ];

    const [reconciled] = reconcileAccountBalances([account], transactions);

    // opening 100_000 − 50_000 − 1_250
    expect(reconciled.balance).toBe(48_750);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/accounts.test.ts`
Expected: FAIL, `feeParentId` unknown OR (once Task 1 is merged) it should actually PASS, proving "no new math." If it already passes, that is the point of the test; keep it as a regression guard and continue.

- [ ] **Step 3: Import the fee builder and category helper in the workspace**

In `components/transactions/use-transactions-workspace.ts`, extend the existing builder import:

```ts
import {
  buildFeeTransaction,
  buildManualTransaction,
  buildTransferPair,
} from "./transaction-builder";
```

and add:

```ts
import { FEES_CATEGORY_ID, buildFeesCategory } from "@/lib/app-state/defaults";
```

- [ ] **Step 4: Persist the fee on save (manual + transfer)**

In `handleTransactionSubmit`, replace the save block (the `if (transactionForm.type === "transfer") { … } else { … }`) with:

```ts
        let feeParentId: string;
        if (transactionForm.type === "transfer") {
          const [source, destination] = buildTransferPair(buildInput);
          feeParentId = source.id;
          await Promise.all([
            repositories.transactions.upsert(source),
            repositories.transactions.upsert(destination),
          ]);
          await persistFee(source, profile.id);
        } else {
          const rules = await repositories.transactionRules.listByUser(profile.id);
          const payment = buildManualTransaction(buildInput, rules);
          feeParentId = payment.id;
          await repositories.transactions.upsert(payment);
          await persistFee(payment, profile.id);
        }
        void feeParentId;
```

- [ ] **Step 5: Add the `persistFee` helper**

Directly above `handleTransactionSubmit` (inside the hook body), add:

```ts
  const persistFee = useCallback(
    async (parent: Transaction, userId: string) => {
      const fee = buildFeeTransaction(parent, transactionForm.feeAmount, FEES_CATEGORY_ID);
      const feeId = `${parent.id}:fee`;
      if (fee) {
        await repositories.categories.upsert(buildFeesCategory(userId));
        await repositories.transactions.upsert(fee);
      } else if (transactions.some((entry) => entry.id === feeId)) {
        // Editing cleared a previously-recorded fee, drop the orphan.
        await repositories.transactions.remove(feeId);
      }
    },
    [transactionForm.feeAmount, transactions],
  );
```

Add `persistFee` to `handleTransactionSubmit`'s dependency array.

- [ ] **Step 6: Prefill the fee when editing a payment**

In `beginTransactionEdit`, add before `setTransactionForm(`:

```ts
    const feeChild = transactions.find((entry) => entry.id === `${transaction.id}:fee`);
```

Add `feeAmount: feeChild ? String(feeChild.originalAmount) : "",` to the `setTransactionForm({ … })` object (after `note:`). Change the callback dependency array from `[]` to `[transactions]`.

- [ ] **Step 7: Cascade-delete the linked fee**

In `handleDeleteTransaction`, replace the delete branch:

```ts
        if (transaction.transferGroupId) {
          const linked = transactions.filter(
            (entry) => entry.transferGroupId === transaction.transferGroupId,
          );
          await Promise.all(linked.map((entry) => repositories.transactions.remove(entry.id)));
        } else {
          await repositories.transactions.remove(transaction.id);
        }
```
with:
```ts
        const idsToRemove = new Set<string>([transaction.id]);
        if (transaction.transferGroupId) {
          transactions
            .filter((entry) => entry.transferGroupId === transaction.transferGroupId)
            .forEach((entry) => idsToRemove.add(entry.id));
        }
        transactions
          .filter((entry) => entry.feeParentId && idsToRemove.has(entry.feeParentId))
          .forEach((entry) => idsToRemove.add(entry.id));
        await Promise.all(
          [...idsToRemove].map((id) => repositories.transactions.remove(id)),
        );
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/domain/accounts.test.ts`
Expected: PASS (balance 48_750).

- [ ] **Step 9: Full gate + build + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
git add components/transactions/use-transactions-workspace.ts lib/domain/accounts.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Persist, prefill, and cascade-delete linked transaction fees"
```

---

## Self-Review

**Spec coverage:**
- Data model `feeParentId` → Task 1 ✓
- Fees category rename + upsert-on-save → Task 1 (seed + `buildFeesCategory`), Task 4 Step 5 (upsert) ✓
- Builder returns payment + optional fee (expense + transfer) → Task 2 (`buildFeeTransaction`) composed in Task 4 Steps 4–5 ✓ (refined from "return `Transaction[]`" to a composable helper to avoid churn to existing builder tests, same behavior, cleaner blast radius)
- Fee on **source** account for transfers → Task 4 Step 4 (`persistFee(source, …)`) ✓
- Form input in details, expense/transfer only, auto-expand → Task 3 Steps 1–4 ✓
- Edit re-derives / clears fee → Task 4 Steps 5–6 ✓
- Delete cascade → Task 4 Step 7 ✓
- Fee rows not independently editable → Task 3 Step 5 ✓
- Tests: builder pair, deterministic id, blank→none, balance proof → Tasks 2 & 4 ✓
- Fee stored UGX-only → Task 2 Step 3 + Global Constraints ✓

**Placeholder scan:** none, every code step shows full content.

**Type consistency:** `buildFeeTransaction(parent, feeAmountRaw, feesCategoryId)`, `FEES_CATEGORY_ID`, `buildFeesCategory(userId)`, `feeParentId`, `feeAmount` used identically across Tasks 1–4. Deterministic fee id `` `${parent.id}:fee` `` matches between builder (Task 2), persist/edit (Task 4 Steps 5–6), and cascade (Task 4 Step 7).
