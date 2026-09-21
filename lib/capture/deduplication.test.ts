import { describe, expect, it } from "vitest";

import { detectCaptureDuplicate } from "./deduplication";
import type { CaptureReviewItem, Transaction } from "@/lib/types";

const candidate = {
  messageHash: "hash:sent-5000",
  accountId: "account:1",
  occurredOn: "2026-04-07",
  type: "expense" as const,
  normalizedAmount: 5000,
  payee: "Grocery",
  note: "Paid UGX 5,000 to Grocery",
};

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "transaction:1",
    userId: "user:1",
    accountId: candidate.accountId,
    type: candidate.type,
    amount: candidate.normalizedAmount,
    currency: "UGX",
    originalAmount: candidate.normalizedAmount,
    occurredOn: candidate.occurredOn,
    categoryId: "category:expense",
    payee: candidate.payee,
    note: candidate.note,
    reconciliationState: "reviewed",
    source: "sms",
    messageHash: candidate.messageHash,
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  } as Transaction;
}

function reviewItem(overrides: Partial<CaptureReviewItem> = {}): CaptureReviewItem {
  return {
    id: "capture-review:1",
    userId: "user:1",
    envelopeId: "capture-envelope:1",
    source: "sms",
    accountId: candidate.accountId,
    occurredOn: candidate.occurredOn,
    originalAmount: candidate.normalizedAmount,
    currency: "UGX",
    normalizedAmount: candidate.normalizedAmount,
    type: candidate.type,
    categoryId: "category:expense",
    payee: candidate.payee,
    note: candidate.note,
    messageHash: candidate.messageHash,
    confidenceScore: 0.8,
    status: "new",
    issues: [],
    fieldWarnings: [],
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    ...overrides,
  } as CaptureReviewItem;
}

describe("detectCaptureDuplicate", () => {
  it("finds nothing in an empty ledger", () => {
    expect(
      detectCaptureDuplicate({ candidate, existingTransactions: [], existingReviewItems: [] }),
    ).toBeNull();
  });

  /* The same message arriving twice is the case this exists for, and a shortcut
     or a re-shared notification is how it happens. */
  it("matches a posted transaction on the message it came from", () => {
    expect(
      detectCaptureDuplicate({ candidate, existingTransactions: [transaction()] }),
    ).toEqual({ transactionId: "transaction:1" });
  });

  /* A message re-captured through another route hashes differently, because the
     hash takes in the source and the app it came from. The fields are what is
     left to recognise it by. */
  it("matches a transaction that looks the same when the hashes differ", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [transaction({ messageHash: "hash:captured-elsewhere" })],
      }),
    ).toEqual({ transactionId: "transaction:1" });
  });

  it("does not match a transaction on another account", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [
          transaction({ messageHash: "hash:other", accountId: "account:2" }),
        ],
      }),
    ).toBeNull();
  });

  it("does not match a different amount, day, or direction", () => {
    for (const difference of [
      { amount: 5001 },
      { occurredOn: "2026-04-08" },
      { type: "income" as const },
    ]) {
      expect(
        detectCaptureDuplicate({
          candidate,
          existingTransactions: [transaction({ messageHash: "hash:other", ...difference })],
        }),
        `${JSON.stringify(difference)} was treated as the same transaction`,
      ).toBeNull();
    }
  });

  /* A payee reached one way is not spelled the way it is reached another, so
     both sides are put through the same normalisation before comparing. */
  it("looks past how a payee was spelled", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [transaction({ messageHash: "hash:other", payee: "  GROCERY  " })],
      }),
    ).toEqual({ transactionId: "transaction:1" });
  });

  it("falls back to the raw payee when a transaction has no chosen one", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [
          transaction({ messageHash: "hash:other", payee: undefined, rawPayee: "Grocery" }),
        ],
      }),
    ).toEqual({ transactionId: "transaction:1" });
  });

  /* A manually entered transaction carries no message hash. It must not be
     mistaken for a capture that has none either, or a real capture would be
     dropped as a duplicate of something unrelated. */
  it("does not match a hand-entered transaction that carries no message hash", () => {
    expect(
      detectCaptureDuplicate({
        candidate: { ...candidate, messageHash: "hash:fresh" },
        existingTransactions: [
          transaction({
            messageHash: undefined,
            payee: "Something else",
            note: "Typed in by hand",
          }),
        ],
      }),
    ).toBeNull();
  });

  it("matches an item already waiting in the inbox", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [],
        existingReviewItems: [reviewItem()],
      }),
    ).toEqual({ reviewItemId: "capture-review:1" });
  });

  /* A posted transaction is the more useful answer of the two: it tells the
     reviewer this is already in the ledger rather than merely queued. */
  it("names the posted transaction when both would match", () => {
    expect(
      detectCaptureDuplicate({
        candidate,
        existingTransactions: [transaction()],
        existingReviewItems: [reviewItem()],
      }),
    ).toEqual({ transactionId: "transaction:1" });
  });

  it("copes with no inbox being passed at all", () => {
    expect(detectCaptureDuplicate({ candidate, existingTransactions: [] })).toBeNull();
  });
});
