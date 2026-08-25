import { describe, expect, it } from "vitest";

import {
  buildTransactionFromCaptureReviewItem,
  mapReviewItemToTransactionFields,
} from "./transaction-factory";
import type { CaptureReviewItem } from "@/lib/types";

function reviewItem(overrides: Partial<CaptureReviewItem> = {}): CaptureReviewItem {
  return {
    id: "capture-review:1",
    userId: "user:1",
    envelopeId: "capture-envelope:1",
    source: "sms",
    accountId: "account:1",
    occurredOn: "2026-04-07",
    originalAmount: 5000,
    currency: "UGX",
    normalizedAmount: 5000,
    type: "expense",
    categoryId: "category:expense",
    payee: "Grocery",
    note: "Paid UGX 5,000 to Grocery",
    messageHash: "hash:1",
    parserLabel: "mtn-momo",
    confidenceScore: 0.8,
    status: "new",
    issues: [],
    fieldWarnings: [],
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:00.000Z",
    ...overrides,
  } as CaptureReviewItem;
}

const timestamp = "2026-04-07T10:00:00.000Z";

describe("mapReviewItemToTransactionFields", () => {
  it("carries the reviewed reading onto the transaction", () => {
    expect(mapReviewItemToTransactionFields(reviewItem(), "user:1", timestamp)).toMatchObject({
      userId: "user:1",
      accountId: "account:1",
      type: "expense",
      amount: 5000,
      currency: "UGX",
      occurredOn: "2026-04-07",
      categoryId: "category:expense",
      payee: "Grocery",
      source: "sms",
      messageHash: "hash:1",
      parserLabel: "mtn-momo",
      confidenceScore: 0.8,
    });
  });

  /* Direction is carried by the type, never by the sign, so a parse that read a
     debit as negative must not post a negative expense on top of it. */
  it("posts an amount without its sign, whichever way the parse read it", () => {
    const fields = mapReviewItemToTransactionFields(
      reviewItem({ normalizedAmount: -5000, originalAmount: -5000 }),
      "user:1",
      timestamp,
    );

    expect(fields.amount).toBe(5000);
    expect(fields.originalAmount).toBe(5000);
    expect(fields.type).toBe("expense");
  });

  /* A rate against the ledger's own currency is meaningless, and storing one
     would make the amount look converted when it never was. */
  it("drops a rate on an amount already in the ledger's currency", () => {
    expect(
      mapReviewItemToTransactionFields(
        reviewItem({ currency: "UGX", fxRateToUgx: 3800 }),
        "user:1",
        timestamp,
      ).fxRateToUgx,
    ).toBeUndefined();
  });

  it("keeps the rate a foreign amount was converted at", () => {
    expect(
      mapReviewItemToTransactionFields(
        reviewItem({ currency: "USD", originalAmount: 20, fxRateToUgx: 3800 }),
        "user:1",
        timestamp,
      ).fxRateToUgx,
    ).toBe(3800);
  });

  /* A payee of spaces is not a payee. Left as an empty string it would read as
     a name the user chose, and sort and group as one. */
  it("treats a blank payee or note as none given", () => {
    const fields = mapReviewItemToTransactionFields(
      reviewItem({ payee: "   ", note: "  " }),
      "user:1",
      timestamp,
    );

    expect(fields.payee).toBeUndefined();
    expect(fields.rawPayee).toBeUndefined();
    expect(fields.note).toBeUndefined();
  });

  it("trims a payee it keeps", () => {
    expect(
      mapReviewItemToTransactionFields(reviewItem({ payee: "  Grocery  " }), "user:1", timestamp)
        .payee,
    ).toBe("Grocery");
  });

  /* Posting from the inbox is the review, so the result is reviewed rather than
     waiting to be. */
  it("posts as reviewed, stamped at the moment it was posted", () => {
    const fields = mapReviewItemToTransactionFields(reviewItem(), "user:1", timestamp);

    expect(fields.reconciliationState).toBe("reviewed");
    expect(fields.reviewedAt).toBe(timestamp);
    expect(fields.createdAt).toBe(timestamp);
    expect(fields.updatedAt).toBe(timestamp);
  });

  it("posts for whoever is posting, not for whoever the item was stored under", () => {
    expect(
      mapReviewItemToTransactionFields(reviewItem({ userId: "user:stale" }), "user:1", timestamp)
        .userId,
    ).toBe("user:1");
  });
});

describe("buildTransactionFromCaptureReviewItem", () => {
  /* The two links are what lets a posted transaction be traced back to the
     message it came from, and what stops the same capture posting twice. */
  it("links the transaction back to the capture it came from", () => {
    expect(
      buildTransactionFromCaptureReviewItem({
        item: reviewItem(),
        userId: "user:1",
        createdAt: timestamp,
      }),
    ).toMatchObject({
      captureEnvelopeId: "capture-envelope:1",
      captureReviewItemId: "capture-review:1",
    });
  });

  it("gives every posted transaction its own id", () => {
    const first = buildTransactionFromCaptureReviewItem({ item: reviewItem(), userId: "user:1" });
    const second = buildTransactionFromCaptureReviewItem({ item: reviewItem(), userId: "user:1" });

    expect(first.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });

  it("does not carry the capture's own id onto the transaction", () => {
    expect(
      buildTransactionFromCaptureReviewItem({ item: reviewItem(), userId: "user:1" }).id,
    ).not.toBe("capture-review:1");
  });

  it("stamps the moment itself when none is given", () => {
    const built = buildTransactionFromCaptureReviewItem({ item: reviewItem(), userId: "user:1" });

    expect(Number.isNaN(new Date(built.createdAt).getTime())).toBe(false);
  });
});
