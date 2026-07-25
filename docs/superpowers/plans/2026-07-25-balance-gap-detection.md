# Balance-Gap Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover hidden bank fees by capturing the stated balance from each message, detecting the gap between checkpoints, and offering a one-tap "Add as fee" in the review queue that prefills the existing fee field.

**Architecture:** `statedBalance` rides parser→candidate→review item→transaction. A pure `detectBalanceGaps` compares consecutive stated-balance checkpoints by delta (no opening-balance dependency). The review queue computes the gap for a pending item against the ledger and, on a shortfall, prefills `feeAmount` — reusing the shipped capture-fee approval path.

**Tech Stack:** TypeScript strict, Vitest, React 19.

## Global Constraints

- Commit with NO Claude affiliation: `git -c commit.gpgsign=false commit --no-verify -m "…"`. Author is Henry Piira.
- Gate every task: `npx tsc --noEmit && npm run lint && npm run test`. `npm run build` before the final commit.
- Gap tolerance: `|gap| ≥ 1` UGX. Negative gap = suspected fee; positive gap = informational only.
- Reuse the existing fee path: "Add as fee" sets `feeAmount`; no new fee-creation code.

---

### Task 1: Capture stated balance through the pipeline

**Files:**
- Modify: `lib/capture/normalizers.ts` (`parseStatedBalance`)
- Modify: `lib/capture/pipeline.ts` (set on candidate)
- Modify: `lib/capture/types.ts` (`CapturePipelineCandidate.statedBalance`)
- Modify: `lib/types.ts` (`CaptureReviewItem`, `CaptureReviewSnapshot`, `Transaction`)
- Modify: `lib/capture/review-item-factory.ts`, `lib/capture/transaction-factory.ts`
- Test: `lib/capture/normalizers.test.ts` (create), `lib/capture/pipeline.test.ts` (extend)

**Interfaces:**
- Produces: `parseStatedBalance(text: string): number | undefined`; `statedBalance?: number` on candidate/item/snapshot/transaction.

- [ ] **Step 1: Write the failing tests**

Create `lib/capture/normalizers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseStatedBalance } from "./normalizers";

describe("parseStatedBalance", () => {
  it("reads the balance MTN/Airtel/Centenary print", () => {
    expect(parseStatedBalance("New balance: 8953. ID :41669823701.")).toBe(8953);
    expect(parseStatedBalance("New balance: UGX 102113.")).toBe(102113);
    expect(parseStatedBalance("Bal UGX 37. 23-July-2026 17:09")).toBe(37);
    expect(parseStatedBalance("Balance UGX 10,037. Trans ID:1")).toBe(10037);
    expect(parseStatedBalance("Bal:1,688,944 (Funds Transfer). Call")).toBe(1688944);
  });

  it("returns undefined when no balance is stated (Absa)", () => {
    expect(
      parseStatedBalance("Absa confirms an ATM cash Withdrawal of UGX 100,000.00 on Acc. ending ***15"),
    ).toBeUndefined();
  });
});
```

Append to `lib/capture/pipeline.test.ts` (inside the existing describe):

```ts
  it("carries the stated balance onto the candidate", () => {
    const envelope = createNotificationEnvelope({
      userId: "u1",
      rawContent: "You have withdrawn UGX 50,000 on 2026-06-27 09:35:56. Fee: UGX 1,500, Tax: UGX 250. New balance: UGX 50,363.01.",
      sourceApp: "com.mtn.uganda.momo",
    });
    const rows = parseCaptureEnvelope({
      envelope, source: "notification", accountId: "account:bank", categories, existingTransactions: [] as Transaction[],
    });
    expect(rows[0].statedBalance).toBe(50363.01);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/capture/normalizers.test.ts lib/capture/pipeline.test.ts`
Expected: FAIL — `parseStatedBalance` missing; candidate has no `statedBalance`.

- [ ] **Step 3: Implement `parseStatedBalance`**

In `lib/capture/normalizers.ts`, add:

```ts
export function parseStatedBalance(text: string): number | undefined {
  const match = text.match(
    /\b(?:new\s+balance|balance|bal)\b\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/i,
  );
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}
```

- [ ] **Step 4: Add the field to the types**

- `lib/capture/types.ts` → `CapturePipelineCandidate`: add `statedBalance?: number;` after `feeAmount?: number;`.
- `lib/types.ts` → `Transaction`: add `statedBalance?: number;` after `feeParentId?: string;`.
- `lib/types.ts` → `CaptureReviewItem`: add `statedBalance?: number;` after `feeAmount?: number;`.
- `lib/types.ts` → `CaptureReviewSnapshot`: add `statedBalance?: number;` after `feeAmount?: number;`.

- [ ] **Step 5: Set it in the pipeline and factories**

- `lib/capture/pipeline.ts`: import `parseStatedBalance` (add to the existing `@/lib/capture/normalizers` import), and in the `candidate` literal add after `feeAmount: providerResult?.feeAmount,`:
  ```ts
      statedBalance: parseStatedBalance(rawText),
  ```
- `lib/capture/review-item-factory.ts`: in both the `originalSnapshot` object and the returned item, add after each `feeAmount: params.candidate.feeAmount,`:
  ```ts
    statedBalance: params.candidate.statedBalance,
  ```
- `lib/capture/transaction-factory.ts`: in `mapReviewItemToTransactionFields` return, add after `note: item.note.trim() || undefined,`:
  ```ts
    statedBalance: item.statedBalance,
  ```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run lib/capture/normalizers.test.ts lib/capture/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 7: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/normalizers.ts lib/capture/pipeline.ts lib/capture/types.ts lib/types.ts lib/capture/review-item-factory.ts lib/capture/transaction-factory.ts lib/capture/normalizers.test.ts lib/capture/pipeline.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Capture stated balance through the capture pipeline"
```

---

### Task 2: `detectBalanceGaps` + `pendingReviewGap`

**Files:**
- Create: `lib/domain/balance-gap.ts`
- Test: `lib/domain/balance-gap.test.ts`

**Interfaces:**
- Consumes: `getTransactionBalanceDelta` (`lib/domain/accounts.ts`), `Transaction`, `CaptureReviewItem`, `statedBalance` (Task 1).
- Produces: `detectBalanceGaps(transactions: Transaction[]): BalanceGap[]`; `pendingReviewGap(item: CaptureReviewItem, ledger: Transaction[]): BalanceGap | null`; `type BalanceGap`.

- [ ] **Step 1: Write the failing test**

Create `lib/domain/balance-gap.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { CaptureReviewItem, Transaction } from "@/lib/types";

import { detectBalanceGaps, pendingReviewGap } from "./balance-gap";

function tx(values: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "occurredOn">): Transaction {
  return {
    userId: "u1", accountId: "acc", currency: "UGX", originalAmount: Math.abs(values.amount),
    categoryId: "c", reconciliationState: "posted", source: "manual",
    createdAt: `${values.occurredOn}T00:00:00.000Z`, updatedAt: `${values.occurredOn}T00:00:00.000Z`,
    ...values,
  };
}

describe("detectBalanceGaps", () => {
  it("finds the hidden fee between two Centenary checkpoints", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "credit", type: "income", amount: 1_790_590, occurredOn: "2026-07-24", statedBalance: 1_791_819 }),
      tx({ id: "debit", type: "expense", amount: 100_000, occurredOn: "2026-07-25", statedBalance: 1_688_944 }),
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ transactionId: "debit", gap: -2_875, statedBalance: 1_688_944 });
  });

  it("reports no gap for a chain that reconciles", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "a", type: "income", amount: 100_000, occurredOn: "2026-07-01", statedBalance: 100_000 }),
      tx({ id: "b", type: "expense", amount: 30_000, occurredOn: "2026-07-02", statedBalance: 70_000 }),
    ]);
    expect(gaps).toHaveLength(0);
  });

  it("does not flag a single checkpoint", () => {
    const gaps = detectBalanceGaps([
      tx({ id: "only", type: "expense", amount: 5_000, occurredOn: "2026-07-01", statedBalance: 5_000 }),
    ]);
    expect(gaps).toHaveLength(0);
  });
});

describe("pendingReviewGap", () => {
  const item = {
    id: "review-1", userId: "u1", accountId: "acc", occurredOn: "2026-07-25",
    originalAmount: 100_000, currency: "UGX", normalizedAmount: 100_000, type: "expense",
    categoryId: "c", payee: "x", note: "", messageHash: "h", confidenceScore: 0.7,
    status: "new", issues: [], fieldWarnings: [], statedBalance: 1_688_944,
    envelopeId: "e", source: "sms",
    originalSnapshot: {} as CaptureReviewItem["originalSnapshot"],
    createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z",
  } as CaptureReviewItem;

  it("detects the shortfall against a prior ledger checkpoint", () => {
    const ledger = [
      tx({ id: "credit", type: "income", amount: 1_790_590, occurredOn: "2026-07-24", statedBalance: 1_791_819 }),
    ];
    const gap = pendingReviewGap(item, ledger);
    expect(gap?.gap).toBe(-2_875);
  });

  it("returns null when the item has no stated balance", () => {
    expect(pendingReviewGap({ ...item, statedBalance: undefined }, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/domain/balance-gap.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `lib/domain/balance-gap.ts`**

```ts
import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import type { CaptureReviewItem, Transaction } from "@/lib/types";

export type BalanceGap = {
  transactionId: string;
  gap: number;
  statedBalance: number;
  expectedBalance: number;
};

const TOLERANCE = 1;

/**
 * Compares consecutive stated-balance checkpoints for a single account's
 * transactions. gap = (statedNow − statedPrev) − Σ(deltas since prev checkpoint).
 * A negative gap is money that left without being recorded — a suspected fee.
 */
export function detectBalanceGaps(transactions: Transaction[]): BalanceGap[] {
  const sorted = [...transactions].sort((a, b) =>
    a.occurredOn === b.occurredOn
      ? a.createdAt.localeCompare(b.createdAt)
      : a.occurredOn.localeCompare(b.occurredOn),
  );

  const gaps: BalanceGap[] = [];
  let previousStated: number | null = null;
  let deltaSinceCheckpoint = 0;

  for (const transaction of sorted) {
    deltaSinceCheckpoint += getTransactionBalanceDelta(transaction);

    if (typeof transaction.statedBalance === "number") {
      if (previousStated !== null) {
        const actualDelta = transaction.statedBalance - previousStated;
        const gap = actualDelta - deltaSinceCheckpoint;
        if (Math.abs(gap) >= TOLERANCE) {
          gaps.push({
            transactionId: transaction.id,
            gap: Math.round(gap),
            statedBalance: transaction.statedBalance,
            expectedBalance: previousStated + deltaSinceCheckpoint,
          });
        }
      }
      previousStated = transaction.statedBalance;
      deltaSinceCheckpoint = 0;
    }
  }

  return gaps;
}

/**
 * Computes the gap for a pending review item by treating it as the newest
 * checkpoint on top of the account's existing ledger. Null when the item states
 * no balance.
 */
export function pendingReviewGap(
  item: CaptureReviewItem,
  ledger: Transaction[],
): BalanceGap | null {
  if (typeof item.statedBalance !== "number") {
    return null;
  }

  const synthetic: Transaction = {
    id: item.id,
    userId: item.userId,
    accountId: item.accountId,
    type: item.type,
    amount: Math.abs(item.normalizedAmount),
    currency: item.currency,
    originalAmount: Math.abs(item.originalAmount),
    occurredOn: item.occurredOn,
    categoryId: item.categoryId,
    reconciliationState: "reviewed",
    source: item.source,
    statedBalance: item.statedBalance,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  const accountLedger = ledger.filter((entry) => entry.accountId === item.accountId);
  return (
    detectBalanceGaps([...accountLedger, synthetic]).find(
      (gap) => gap.transactionId === item.id,
    ) ?? null
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/domain/balance-gap.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/domain/balance-gap.ts lib/domain/balance-gap.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Add balance-gap detection for hidden bank fees"
```

---

### Task 3: Surface the gap in the review queue

**Files:**
- Modify: `components/transactions-capture-review-workspace.tsx` (pass `transactions`)
- Modify: `components/transactions/capture-review-queue.tsx` (prop + hint + Add-as-fee)

**Interfaces:**
- Consumes: `pendingReviewGap` (Task 2), `workspace.transactions`.

- [ ] **Step 1: Pass ledger transactions into the queue**

In `components/transactions-capture-review-workspace.tsx`, add to the `<CaptureReviewQueue …>` props:

```tsx
          transactions={workspace.transactions}
```

- [ ] **Step 2: Thread the prop and render the hint**

In `components/transactions/capture-review-queue.tsx`:

Add `import type { Transaction } from "@/lib/types";` (extend the existing type import if present) and `import { pendingReviewGap } from "@/lib/domain/balance-gap";`, plus `formatMoney` is already imported.

Add `transactions: Transaction[];` to `CaptureReviewQueueProps`. Thread it into `ReviewItemEditor` (it receives `...props`), then inside `ReviewItemEditor` compute:

```tsx
  const gap = useMemo(() => pendingReviewGap(draft, transactions), [draft, transactions]);
```

(destructure `transactions` from the editor's props alongside `item`, `accounts`, …).

Immediately above the actions row (the `Save changes` / `Approve to ledger` buttons), add:

```tsx
      {gap && gap.gap < 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-warn/40 bg-warn/10 px-3 py-2 text-xs">
          <span className="text-foreground">
            Bank balance is {formatMoney(Math.abs(gap.gap), "UGX")} lower than recorded — likely an
            unrecorded fee.
          </span>
          <button
            type="button"
            className="rounded-md border border-border/40 px-2 py-1 font-medium hover:bg-muted"
            onClick={() => setDraft((current) => ({ ...current, feeAmount: Math.abs(gap.gap) }))}
          >
            Add as fee
          </button>
        </div>
      ) : gap && gap.gap > 0 ? (
        <div className="border border-border/30 px-3 py-2 text-xs text-muted-foreground">
          Bank balance is {formatMoney(gap.gap, "UGX")} higher than recorded — an uncaptured credit?
        </div>
      ) : null}
```

If `useMemo` is not already imported from React in this file, add it to the import.
If a `warn` color token is unavailable, use `border-border/40 bg-muted/40` instead.

- [ ] **Step 3: Gate + build + commit**

`pendingReviewGap` is unit-tested (Task 2); TypeScript proves the wiring; the "Add as
fee" button reuses the tested fee-approval path.

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
git add components/transactions-capture-review-workspace.tsx components/transactions/capture-review-queue.tsx
git -c commit.gpgsign=false commit --no-verify -m "Surface balance-gap fee suggestion in the review queue"
```

---

## Self-Review

**Spec coverage:**
- `parseStatedBalance` + wiring through candidate/item/snapshot/transaction → Task 1 ✓
- Delta-based `detectBalanceGaps` + `pendingReviewGap` → Task 2 ✓
- Review-queue hint + "Add as fee" prefilling `feeAmount` → Task 3 ✓
- Positive gap = informational only → Task 3 ✓
- Reuse fee path (no new fee creation) → Task 3 (sets `feeAmount`) ✓

**Placeholder scan:** none.

**Type consistency:** `statedBalance?: number` identical on `CapturePipelineCandidate`, `CaptureReviewItem`, `CaptureReviewSnapshot`, `Transaction`. `detectBalanceGaps(Transaction[]): BalanceGap[]`, `pendingReviewGap(CaptureReviewItem, Transaction[]): BalanceGap | null`. The Centenary −2,875 figure is consistent between spec, `detectBalanceGaps` test, and `pendingReviewGap` test.

**Warn-token note:** Task 3 Step 2 documents a fallback if `warn` isn't a theme color, so the step can't get stuck.
