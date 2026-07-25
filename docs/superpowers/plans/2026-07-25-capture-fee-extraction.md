# Capture Fee Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the fee/tax/charge from captured mobile-money and bank messages, carry it through the review queue, and materialize it as the linked fee expense on approve — reusing the shipped v1 fee helpers.

**Architecture:** A `feeAmount?: number` (UGX) rides five hops: parser → pipeline candidate → review item (+ snapshot) → review-queue editor → approve. Extraction is a whole-message scan independent of the amount/payee regexes, so the principal is untouched. On approve, the existing `buildFeeTransaction` + `buildFeesCategory` (from v1) create the linked `` `${paymentId}:fee` `` expense.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Vitest, IndexedDB repositories.

## Global Constraints

- Commit with NO Claude affiliation: `git -c commit.gpgsign=false commit --no-verify -m "…"`. Author is Henry Piira.
- Gate every task: `npx tsc --noEmit && npm run lint && npm run test`. Run `npm run build` before the final commit.
- Fee is UGX and expense-only. Income/credited messages never extract a fee.
- "Fee" = the **sum** of all `Fee` / `Tax` / `Charge` / `Excise duty` lines in the message.
- Reuse v1 helpers verbatim: `buildFeeTransaction` (`components/transactions/transaction-builder.ts`), `FEES_CATEGORY_ID` + `buildFeesCategory` (`lib/app-state/defaults.ts`).
- Do not change principal-amount extraction — existing parser tests must stay green.

---

### Task 1: `parseCaptureFee` helper + `feeAmount` in the three parsers

**Files:**
- Modify: `lib/capture/types.ts` (`CaptureProviderResult`)
- Modify: `lib/capture/providers/shared.ts` (new helper)
- Modify: `lib/capture/providers/mtn-uganda.ts`, `airtel-money-uganda.ts`, `bank-alert-generic.ts`
- Test: `lib/capture/providers/shared.test.ts` (create)

**Interfaces:**
- Produces: `parseCaptureFee(text: string): number | undefined`; `CaptureProviderResult.feeAmount?: number`.

- [ ] **Step 1: Write the failing test**

Create `lib/capture/providers/shared.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseCaptureFee } from "./shared";
import { parseMtnUgandaMessage } from "./mtn-uganda";

describe("parseCaptureFee", () => {
  it("sums fee, tax, and excise-duty lines", () => {
    expect(
      parseCaptureFee("Sent UGX 50,000 to JOHN. Fee UGX 1,000. Tax UGX 250."),
    ).toBe(1250);
    expect(parseCaptureFee("Withdraw UGX 100,000. Fee 2,200. Excise duty UGX 220.")).toBe(2420);
  });

  it("returns undefined when there are no charge lines", () => {
    expect(parseCaptureFee("Received UGX 500,000 from Employer Ltd")).toBeUndefined();
  });

  it("does not match 'charge' inside another word", () => {
    expect(parseCaptureFee("Airtime recharge UGX 5,000 successful")).toBeUndefined();
  });
});

describe("parseMtnUgandaMessage fee extraction", () => {
  it("attaches the summed fee to an outgoing message", () => {
    const result = parseMtnUgandaMessage("Sent UGX 50,000 to JOHN DOE. Fee UGX 1,000. Tax UGX 250");
    expect(result?.type).toBe("expense");
    expect(result?.feeAmount).toBe(1250);
  });

  it("does not attach a fee to an incoming message", () => {
    const result = parseMtnUgandaMessage("Received UGX 500,000 from Employer Ltd on 27-03-2026");
    expect(result?.type).toBe("income");
    expect(result?.feeAmount).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/capture/providers/shared.test.ts`
Expected: FAIL — `parseCaptureFee` not exported.

- [ ] **Step 3: Add `feeAmount` to `CaptureProviderResult`**

In `lib/capture/types.ts`, add to `CaptureProviderResult` after `note?: string;`:

```ts
  feeAmount?: number;
```

- [ ] **Step 4: Implement `parseCaptureFee`**

Append to `lib/capture/providers/shared.ts`:

```ts
/**
 * Sums every charge line (fee / tax / charge / excise duty) in a captured
 * message. Returns undefined when the message states no charges. Word-boundary
 * anchored so "recharge" does not count as a charge.
 */
export function parseCaptureFee(text: string): number | undefined {
  const matches = text.matchAll(
    /\b(?:excise\s+duty|fee|tax|charge)s?\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/gi,
  );
  let total = 0;
  let found = false;
  for (const match of matches) {
    total += parseAmount(match[1]);
    found = true;
  }
  return found ? total : undefined;
}
```

- [ ] **Step 5: Set `feeAmount` on the three parsers' expense results**

In `lib/capture/providers/mtn-uganda.ts`, add `parseCaptureFee` to the import and add `feeAmount: parseCaptureFee(text),` to the **outgoing** result object (after `note: text,`):

```ts
import { normalizeCurrency, parseAmount, parseCaptureFee, toIsoDate } from "@/lib/capture/providers/shared";
```
```ts
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
```

Do the same in `lib/capture/providers/airtel-money-uganda.ts` (the `outgoing` result) and `lib/capture/providers/bank-alert-generic.ts` (the `debited` result): add `parseCaptureFee` to each import and `feeAmount: parseCaptureFee(text),` after that result's `note: text,`. Leave the incoming/credited results unchanged.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/capture/providers/shared.test.ts`
Expected: PASS.

- [ ] **Step 7: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/types.ts lib/capture/providers/
git -c commit.gpgsign=false commit --no-verify -m "Extract fee/tax/charge total from captured messages"
```

---

### Task 2: Pipeline carries `feeAmount` onto the candidate

**Files:**
- Modify: `lib/capture/types.ts` (`CapturePipelineCandidate`)
- Modify: `lib/capture/pipeline.ts`
- Test: `lib/capture/pipeline.test.ts`

**Interfaces:**
- Consumes: `CaptureProviderResult.feeAmount` (Task 1).
- Produces: `CapturePipelineCandidate.feeAmount?: number`.

- [ ] **Step 1: Write the failing test**

Append to `lib/capture/pipeline.test.ts` (inside the existing `describe("parseCaptureEnvelope", …)`):

```ts
  it("carries the extracted fee onto the candidate", () => {
    const envelope = createNotificationEnvelope({
      userId: "u1",
      rawContent: "Sent UGX 50,000 to JOHN DOE. Fee UGX 1,000. Tax UGX 250",
      sourceApp: "com.mtn.uganda.momo",
    });

    const rows = parseCaptureEnvelope({
      envelope,
      source: "notification",
      accountId: "account:bank",
      categories,
      existingTransactions: [] as Transaction[],
    });

    expect(rows[0].type).toBe("expense");
    expect(rows[0].feeAmount).toBe(1250);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/capture/pipeline.test.ts`
Expected: FAIL — `feeAmount` is `undefined` / not on the candidate type.

- [ ] **Step 3: Add `feeAmount` to `CapturePipelineCandidate`**

In `lib/capture/types.ts`, add to `CapturePipelineCandidate` after `fxRateToUgx?: number;`:

```ts
  feeAmount?: number;
```

- [ ] **Step 4: Set it in the pipeline**

In `lib/capture/pipeline.ts`, inside the `const candidate: CapturePipelineCandidate = { … }` literal, add after `fxRateToUgx,`:

```ts
      feeAmount: providerResult?.feeAmount,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/capture/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/types.ts lib/capture/pipeline.ts lib/capture/pipeline.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Carry captured fee through the pipeline candidate"
```

---

### Task 3: Review item + snapshot carry `feeAmount`

**Files:**
- Modify: `lib/types.ts` (`CaptureReviewItem`, `CaptureReviewSnapshot`)
- Modify: `lib/capture/review-item-factory.ts`
- Test: `lib/capture/review-queue.test.ts`

**Interfaces:**
- Consumes: `CapturePipelineCandidate.feeAmount` (Task 2).
- Produces: `CaptureReviewItem.feeAmount?: number`, `CaptureReviewSnapshot.feeAmount?: number`.

- [ ] **Step 1: Write the failing test**

Append to `lib/capture/review-queue.test.ts`. First confirm the existing imports include `createCaptureReviewItem` (it is re-exported from `review-queue`); if not present, add it to the existing import from `./review-queue`. Then add:

```ts
describe("createCaptureReviewItem fee", () => {
  it("copies the candidate fee onto the item and its snapshot", () => {
    const base = parseCaptureText({
      input: "Sent UGX 50,000 to JOHN DOE. Fee UGX 1,000. Tax UGX 250",
      source: "sms",
      accountId: "account:momo",
      categories,
      existingTransactions: [],
    })[0];

    const item = createCaptureReviewItem({
      userId: "u1",
      envelopeId: "envelope:1",
      candidate: base,
      capturedAt: "2026-04-10T00:00:00.000Z",
    });

    expect(item.feeAmount).toBe(1250);
    expect(item.originalSnapshot.feeAmount).toBe(1250);
  });
});
```

If `parseCaptureText`, `categories`, or `createCaptureReviewItem` are not already imported in this test file, add:
```ts
import { parseCaptureText } from "./message-parser";
import { createCaptureReviewItem } from "./review-queue";
```
and a `categories` fixture matching the one in `message-parser.test.ts` (income/expense/savings).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/capture/review-queue.test.ts`
Expected: FAIL — `feeAmount` not on the item / snapshot.

- [ ] **Step 3: Add `feeAmount` to the types**

In `lib/types.ts`, add `feeAmount?: number;` to `CaptureReviewItem` (after `fxRateToUgx?: number;`) and to `CaptureReviewSnapshot` (after `fxRateToUgx?: number;`).

- [ ] **Step 4: Populate it in the factory**

In `lib/capture/review-item-factory.ts`:

- In the `originalSnapshot` object, add after `fxRateToUgx: params.candidate.fxRateToUgx,`:
  ```ts
    feeAmount: params.candidate.feeAmount,
  ```
- In the returned review item object, add after `fxRateToUgx: params.candidate.fxRateToUgx,`:
  ```ts
    feeAmount: params.candidate.feeAmount,
  ```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/capture/review-queue.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/types.ts lib/capture/review-item-factory.ts lib/capture/review-queue.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Carry captured fee onto the review item and snapshot"
```

---

### Task 4: Editable fee input in the review queue

**Files:**
- Modify: `components/transactions/capture-review-queue.tsx`

**Interfaces:**
- Consumes: `CaptureReviewItem.feeAmount` (Task 3). The editor's `draft` is a `CaptureReviewItem`, saved via the existing `onUpdateItem`.

- [ ] **Step 1: Add the fee input to `ReviewItemEditor`**

In `components/transactions/capture-review-queue.tsx`, directly after the amount `InputField` (the one bound to `draft.originalAmount`) and still inside the same grid `<div>`, add:

```tsx
        {draft.type === "expense" ? (
          <InputField
            id={`capture-review-fee-${draft.id}`}
            label="Fee — charges & tax (UGX)"
            inputMode="decimal"
            value={draft.feeAmount ? String(draft.feeAmount) : ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                feeAmount: Number(event.target.value) || undefined,
              }))
            }
          />
        ) : null}
```

- [ ] **Step 2: Verify types + gate**

The `draft` is a `CaptureReviewItem`, which now has `feeAmount` (Task 3), so this type-checks and the existing save path (`onUpdateItem(draft)`) persists it unchanged.

```bash
npx tsc --noEmit && npm run lint && npm run test
git add components/transactions/capture-review-queue.tsx
git -c commit.gpgsign=false commit --no-verify -m "Add editable fee input to the capture review queue"
```

---

### Task 5: Approve materializes the linked fee

**Files:**
- Modify: `components/transactions/use-capture-review-workspace.ts`

**Interfaces:**
- Consumes: `CaptureReviewItem.feeAmount` (Task 3), `buildFeeTransaction` (v1), `FEES_CATEGORY_ID` + `buildFeesCategory` (v1).

- [ ] **Step 1: Add the imports**

In `components/transactions/use-capture-review-workspace.ts`, add:

```ts
import { buildFeeTransaction } from "@/components/transactions/transaction-builder";
import { FEES_CATEGORY_ID, buildFeesCategory } from "@/lib/app-state/defaults";
```

- [ ] **Step 2: Create the fee after the payment is upserted**

In `approveItem`, immediately after `await repositories.transactions.upsert(proposed);`, add:

```ts
      if (typeof item.feeAmount === "number" && item.feeAmount > 0) {
        const fee = buildFeeTransaction(proposed, String(item.feeAmount), FEES_CATEGORY_ID);
        if (fee) {
          await repositories.categories.upsert(buildFeesCategory(profile.id));
          await repositories.transactions.upsert(fee);
        }
      }
```

- [ ] **Step 3: Record the fee in the correction-log snapshot**

In the same function, add `feeAmount: item.feeAmount,` to the `approvedSnapshot` object (after `fxRateToUgx: item.fxRateToUgx,`).

- [ ] **Step 4: Full gate + build + commit**

The composed logic reuses `buildFeeTransaction` (unit-tested in the v1 plan) and is fully type-checked; the build confirms the wiring. Approving a captured item with a fee now writes both the payment and a linked `` `${paymentId}:fee` `` expense.

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
git add components/transactions/use-capture-review-workspace.ts
git -c commit.gpgsign=false commit --no-verify -m "Materialize the linked fee when approving a captured item"
```

---

## Self-Review

**Spec coverage:**
- Parser `feeAmount` + `parseCaptureFee` summing all charge lines, expense-only → Task 1 ✓
- Pipeline carry → Task 2 ✓
- Review item + snapshot → Task 3 ✓
- Editable fee in review queue (expense only) → Task 4 ✓
- Approve reuses v1 helpers + snapshot records fee → Task 5 ✓
- No new cascade (v1 delete-cascade covers deletion) → noted in spec; nothing to build ✓
- Tests: parseCaptureFee unit, parser fee, pipeline carry, factory carry → Tasks 1–3 ✓

**Placeholder scan:** none — all code steps show full content.

**Type consistency:** `feeAmount?: number` used identically on `CaptureProviderResult`, `CapturePipelineCandidate`, `CaptureReviewItem`, `CaptureReviewSnapshot`. `parseCaptureFee(text): number | undefined`, `buildFeeTransaction(parent, String(feeAmount), FEES_CATEGORY_ID)`, `buildFeesCategory(userId)`, `FEES_CATEGORY_ID` match their v1 definitions. Fee id `` `${proposed.id}:fee` `` derived inside `buildFeeTransaction` matches the v1 cascade key.
