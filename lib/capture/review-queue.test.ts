import { describe, expect, it } from "vitest";

import { buildTransactionFromCaptureReviewItem, createCaptureReviewItem } from "@/lib/capture/review-queue";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";

const baseCandidate: ParsedCaptureCandidate = {
  id: "capture:1",
  rawText: "Received UGX 50,000 from Sender",
  occurredOn: "2026-04-06",
  originalAmount: 50000,
  currency: "UGX",
  normalizedAmount: 50000,
  type: "income",
  categoryId: "category:income",
  accountId: "account:bank",
  payee: "Sender",
  note: "Received UGX 50,000 from Sender",
  source: "sms",
  messageHash: "hash:123",
  parserLabel: "mtn-uganda",
  confidence: 0.9,
  duplicate: false,
  issues: [],
};

describe("capture review queue", () => {
  it("marks duplicate candidates as duplicate review items", () => {
    const reviewItem = createCaptureReviewItem({
      userId: "user:1",
      envelopeId: "capture-envelope:1",
      candidate: {
        ...baseCandidate,
        duplicate: true,
        duplicateTransactionId: "transaction:existing",
        issues: ["Likely duplicate"],
      },
      capturedAt: "2026-04-06T10:00:00.000Z",
    });

    expect(reviewItem.status).toBe("duplicate");
    expect(reviewItem.duplicateTransactionId).toBe("transaction:existing");
  });

  it("builds a review-linked transaction from an approved item", () => {
    const reviewItem = createCaptureReviewItem({
      userId: "user:1",
      envelopeId: "capture-envelope:1",
      candidate: baseCandidate,
      capturedAt: "2026-04-06T10:00:00.000Z",
    });

    const transaction = buildTransactionFromCaptureReviewItem({
      item: reviewItem,
      userId: "user:1",
      createdAt: "2026-04-06T11:00:00.000Z",
    });

    expect(transaction.captureEnvelopeId).toBe("capture-envelope:1");
    expect(transaction.captureReviewItemId).toBe(reviewItem.id);
    expect(transaction.parserLabel).toBe("mtn-uganda");
    expect(transaction.confidenceScore).toBe(0.9);
  });
});
