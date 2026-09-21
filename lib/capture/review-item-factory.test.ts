import { describe, expect, it } from "vitest";

import {
  createCaptureReviewItem,
  getOpenCaptureReviewItems,
  validateCaptureReviewItem,
} from "./review-item-factory";
import type { ParsedCaptureCandidate } from "./message-parser";
import type { CaptureReviewItem } from "@/lib/types";

function candidate(overrides: Partial<ParsedCaptureCandidate> = {}): ParsedCaptureCandidate {
  return {
    id: "capture:0",
    rawText: "Paid UGX 5,000 to Grocery on 07-04-2026",
    occurredOn: "2026-04-07",
    originalAmount: 5000,
    currency: "UGX",
    normalizedAmount: 5000,
    type: "expense",
    categoryId: "category:expense",
    accountId: "account:1",
    payee: "Grocery",
    note: "Paid UGX 5,000 to Grocery on 07-04-2026",
    source: "sms",
    messageHash: "hash:1",
    confidence: 0.8,
    fieldWarnings: [],
    duplicate: false,
    issues: [],
    ...overrides,
  } as ParsedCaptureCandidate;
}

const identity = { userId: "user:1", envelopeId: "capture-envelope:1" };

describe("validateCaptureReviewItem", () => {
  it("finds nothing wrong with a readable UGX amount", () => {
    expect(validateCaptureReviewItem({ originalAmount: 5000, currency: "UGX" })).toEqual([]);
  });

  it("reports an amount it could not read", () => {
    expect(validateCaptureReviewItem({ originalAmount: 0, currency: "UGX" })).toEqual([
      "Invalid amount",
    ]);
  });

  it("reports a foreign amount with no rate to convert it", () => {
    expect(validateCaptureReviewItem({ originalAmount: 20, currency: "USD" })).toEqual([
      "Missing FX rate",
    ]);
    expect(
      validateCaptureReviewItem({ originalAmount: 20, currency: "USD", fxRateToUgx: 3800 }),
    ).toEqual([]);
  });

  it("reports a capture that repeats one already in the ledger", () => {
    expect(
      validateCaptureReviewItem({
        originalAmount: 5000,
        currency: "UGX",
        duplicateTransactionId: "transaction:1",
      }),
    ).toEqual(["Likely duplicate"]);
  });

  /* Only what stops a capture being posted is listed here. A missing date or
     payee is carried as a field warning instead, so it shows without reading as
     a reason the capture cannot go through. */
  it("leaves a missing date to the field warnings", () => {
    expect(validateCaptureReviewItem({ originalAmount: 5000, currency: "UGX" })).not.toContain(
      "Date was not found in the captured text.",
    );
  });
});

describe("createCaptureReviewItem", () => {
  it("carries the candidate's reading of the message onto the item", () => {
    expect(createCaptureReviewItem({ ...identity, candidate: candidate() })).toMatchObject({
      userId: "user:1",
      envelopeId: "capture-envelope:1",
      accountId: "account:1",
      occurredOn: "2026-04-07",
      normalizedAmount: 5000,
      type: "expense",
      payee: "Grocery",
      messageHash: "hash:1",
      confidenceScore: 0.8,
    });
  });

  it("is new when the parse raised nothing", () => {
    expect(createCaptureReviewItem({ ...identity, candidate: candidate() }).status).toBe("new");
  });

  it("needs review when the parse raised something", () => {
    expect(
      createCaptureReviewItem({
        ...identity,
        candidate: candidate({ issues: ["Invalid normalized amount"] }),
      }).status,
    ).toBe("needs_review");
  });

  it("is a duplicate whichever side it repeats", () => {
    expect(
      createCaptureReviewItem({
        ...identity,
        candidate: candidate({ duplicate: true, duplicateTransactionId: "transaction:1" }),
      }).status,
    ).toBe("duplicate");
    expect(
      createCaptureReviewItem({
        ...identity,
        candidate: candidate({
          duplicate: true,
          duplicateCaptureReviewItemId: "capture-review:9",
        }),
      }).status,
    ).toBe("duplicate");
  });

  it("calls it a duplicate before it calls it unreviewed", () => {
    expect(
      createCaptureReviewItem({
        ...identity,
        candidate: candidate({ duplicate: true, issues: ["Invalid normalized amount"] }),
      }).status,
    ).toBe("duplicate");
  });

  /* The status follows what the parse raised, while the listed issues are worked
     out again from the amount and currency alone, so the two can disagree. No
     real message reaches this today, because a date that cannot be read falls
     back to today rather than going missing. Held here so that the day one does,
     it is a failing test rather than a row that says nothing. */
  it("can ask for review while listing no issue of its own", () => {
    const item = createCaptureReviewItem({
      ...identity,
      candidate: candidate({
        issues: ["Date was not found in the captured text."],
        fieldWarnings: [
          { field: "date", level: "warning", message: "Date was not found in the captured text." },
        ],
      }),
    });

    expect(item.status).toBe("needs_review");
    expect(item.issues).toEqual([]);
    expect(item.fieldWarnings).toHaveLength(1);
  });

  /* The snapshot is what a correction is measured against later, so it has to
     hold the parse as it first read, untouched by any edit. */
  it("keeps the first reading as a snapshot beside the working copy", () => {
    const item = createCaptureReviewItem({ ...identity, candidate: candidate() });

    expect(item.originalSnapshot).toMatchObject({
      accountId: "account:1",
      occurredOn: "2026-04-07",
      normalizedAmount: 5000,
      payee: "Grocery",
      confidenceScore: 0.8,
    });
  });

  it("uses the moment the capture happened for both timestamps", () => {
    const item = createCaptureReviewItem({
      ...identity,
      candidate: candidate(),
      capturedAt: "2026-04-07T10:00:00.000Z",
    });

    expect(item.createdAt).toBe("2026-04-07T10:00:00.000Z");
    expect(item.updatedAt).toBe("2026-04-07T10:00:00.000Z");
  });

  it("stamps the moment itself when none is given", () => {
    const item = createCaptureReviewItem({ ...identity, candidate: candidate() });

    expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
  });

  it("gives every item its own id", () => {
    const first = createCaptureReviewItem({ ...identity, candidate: candidate() });
    const second = createCaptureReviewItem({ ...identity, candidate: candidate() });

    expect(first.id).not.toBe(second.id);
  });
});

describe("getOpenCaptureReviewItems", () => {
  function item(status: CaptureReviewItem["status"], id: string): CaptureReviewItem {
    return { ...createCaptureReviewItem({ ...identity, candidate: candidate() }), status, id };
  }

  it("keeps what still needs a decision", () => {
    const open = getOpenCaptureReviewItems([
      item("new", "a"),
      item("needs_review", "b"),
      item("duplicate", "c"),
      item("approved", "d"),
      item("rejected", "e"),
    ]);

    expect(open.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  /* A duplicate is still a decision: the reviewer is the one who says whether it
     really repeats something, so it cannot be filtered away as settled. */
  it("leaves a duplicate for someone to decide on", () => {
    expect(getOpenCaptureReviewItems([item("duplicate", "c")])).toHaveLength(1);
  });

  it("returns nothing from an empty inbox", () => {
    expect(getOpenCaptureReviewItems([])).toEqual([]);
  });
});
