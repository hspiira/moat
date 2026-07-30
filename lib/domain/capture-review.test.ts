import { describe, expect, it } from "vitest";

import type { CaptureReviewItem, CaptureReviewSnapshot, Transaction } from "@/lib/types";

import {
  canApproveCaptureItem,
  captureReviewSections,
  diffCaptureFromOriginal,
  getSectionCounts,
  getSectionItems,
  getSectionOf,
  isCaptureItemEditable,
  resolveDuplicateCounterpart,
} from "./capture-review";

function snapshot(values: Partial<CaptureReviewSnapshot> = {}): CaptureReviewSnapshot {
  return {
    accountId: "acc-1",
    occurredOn: "2026-07-24",
    originalAmount: 86_400,
    currency: "UGX",
    normalizedAmount: 86_400,
    type: "expense",
    categoryId: "cat-groceries",
    payee: "Shoprite",
    note: "",
    confidenceScore: 0.92,
    issues: [],
    fieldWarnings: [],
    ...values,
  };
}

function item(
  values: Partial<CaptureReviewItem> & Pick<CaptureReviewItem, "id">,
): CaptureReviewItem {
  const base = snapshot();
  return {
    userId: "u1",
    envelopeId: "env-1",
    source: "sms",
    accountId: base.accountId,
    occurredOn: base.occurredOn,
    originalAmount: base.originalAmount,
    currency: base.currency,
    normalizedAmount: base.normalizedAmount,
    type: base.type,
    categoryId: base.categoryId,
    payee: base.payee,
    note: base.note,
    messageHash: "hash-1",
    confidenceScore: base.confidenceScore,
    status: "new",
    issues: [],
    fieldWarnings: [],
    originalSnapshot: base,
    createdAt: "2026-07-24T08:00:00.000Z",
    updatedAt: "2026-07-24T08:00:00.000Z",
    ...values,
  };
}

function transaction(
  values: Partial<Transaction> & Pick<Transaction, "id">,
): Transaction {
  return {
    userId: "u1",
    accountId: "acc-1",
    type: "expense",
    amount: 86_400,
    currency: "UGX",
    originalAmount: 86_400,
    occurredOn: "2026-07-24",
    categoryId: "cat-groceries",
    reconciliationState: "posted",
    source: "sms",
    createdAt: "2026-07-24T08:00:00.000Z",
    updatedAt: "2026-07-24T08:00:00.000Z",
    ...values,
  };
}

describe("getSectionItems", () => {
  const items = [
    item({ id: "a", status: "new" }),
    item({ id: "b", status: "needs_review", issues: ["Invalid amount"] }),
    item({ id: "c", status: "duplicate", duplicateTransactionId: "transaction:1" }),
    item({ id: "d", status: "approved" }),
    item({ id: "e", status: "rejected" }),
  ];

  it("gathers everything still awaiting a decision into one section", () => {
    // new, needs_review and duplicate differ only in why they are open, which
    // the row shows with a glyph — they do not each need their own tab.
    expect(getSectionItems(items, "to_review").map((entry) => entry.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps approved and rejected apart rather than merging them as resolved", () => {
    expect(getSectionItems(items, "approved").map((entry) => entry.id)).toEqual(["d"]);
    expect(getSectionItems(items, "rejected").map((entry) => entry.id)).toEqual(["e"]);
  });

  it("puts approvable items first so a clean batch can be cleared in a run", () => {
    const ordered = getSectionItems(items, "to_review");
    expect(ordered[0].id).toBe("a");
    expect(ordered.slice(1).map((entry) => entry.id).sort()).toEqual(["b", "c"]);
  });

  it("orders settled sections newest first", () => {
    const ordered = getSectionItems(
      [
        item({ id: "older", status: "approved", resolvedAt: "2026-07-20T08:00:00.000Z" }),
        item({ id: "newer", status: "approved", resolvedAt: "2026-07-26T08:00:00.000Z" }),
      ],
      "approved",
    );
    expect(ordered.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("counts by section, not by status", () => {
    expect(getSectionCounts(items)).toEqual({ to_review: 3, approved: 1, rejected: 1 });
  });

  it("counts every section, including the empty ones", () => {
    expect(getSectionCounts([])).toEqual({ to_review: 0, approved: 0, rejected: 0 });
  });

  it("maps each status to the section it belongs in", () => {
    expect(captureReviewSections).toEqual(["to_review", "approved", "rejected"]);
    expect(getSectionOf(item({ id: "a", status: "new" }))).toBe("to_review");
    expect(getSectionOf(item({ id: "b", status: "needs_review" }))).toBe("to_review");
    expect(getSectionOf(item({ id: "c", status: "duplicate" }))).toBe("to_review");
    expect(getSectionOf(item({ id: "d", status: "approved" }))).toBe("approved");
    expect(getSectionOf(item({ id: "e", status: "rejected" }))).toBe("rejected");
  });
});

describe("isCaptureItemEditable", () => {
  it("allows editing while an item is still open", () => {
    expect(isCaptureItemEditable(item({ id: "a", status: "new" }))).toBe(true);
    expect(isCaptureItemEditable(item({ id: "b", status: "needs_review" }))).toBe(true);
    expect(isCaptureItemEditable(item({ id: "c", status: "duplicate" }))).toBe(true);
  });

  it("refuses to edit a settled item", () => {
    expect(isCaptureItemEditable(item({ id: "d", status: "approved" }))).toBe(false);
    expect(isCaptureItemEditable(item({ id: "e", status: "rejected" }))).toBe(false);
  });
});

describe("canApproveCaptureItem", () => {
  it("approves a clean open item", () => {
    expect(canApproveCaptureItem(item({ id: "a" }))).toBe(true);
  });

  it("refuses an item that already reached the ledger", () => {
    expect(
      canApproveCaptureItem(
        item({ id: "a", status: "approved", approvedTransactionId: "transaction:1" }),
      ),
    ).toBe(false);
  });

  it("refuses an item carrying an approved transaction id whatever its status says", () => {
    // The status regression bug used to leave this pairing behind: an approved
    // item pushed back to "new" keeps its ledger link and must not be re-approved.
    expect(
      canApproveCaptureItem(item({ id: "a", status: "new", approvedTransactionId: "transaction:1" })),
    ).toBe(false);
  });

  it("refuses an item with unresolved issues", () => {
    expect(canApproveCaptureItem(item({ id: "a", issues: ["Invalid amount"] }))).toBe(false);
  });

  it("refuses a rejected item", () => {
    expect(canApproveCaptureItem(item({ id: "a", status: "rejected" }))).toBe(false);
  });
});

describe("resolveDuplicateCounterpart", () => {
  it("resolves a link to an existing ledger transaction", () => {
    const counterpart = resolveDuplicateCounterpart(
      item({ id: "a", status: "duplicate", duplicateTransactionId: "transaction:1" }),
      [transaction({ id: "transaction:1", payee: "Shoprite" })],
      [],
    );
    expect(counterpart).toEqual({
      kind: "transaction",
      occurredOn: "2026-07-24",
      accountId: "acc-1",
      payee: "Shoprite",
      amount: 86_400,
      currency: "UGX",
      reference: "transaction:1",
    });
  });

  it("resolves a link to a sibling capture", () => {
    const counterpart = resolveDuplicateCounterpart(
      item({ id: "a", status: "duplicate", duplicateCaptureReviewItemId: "capture-review:2" }),
      [],
      [item({ id: "capture-review:2", payee: "Shoprite Lugogo" })],
    );
    expect(counterpart).toMatchObject({ kind: "capture", payee: "Shoprite Lugogo" });
  });

  it("returns null when the item is not marked as a duplicate of anything", () => {
    expect(resolveDuplicateCounterpart(item({ id: "a", status: "duplicate" }), [], [])).toBeNull();
  });

  it("returns null when the linked record has since been deleted", () => {
    expect(
      resolveDuplicateCounterpart(
        item({ id: "a", status: "duplicate", duplicateTransactionId: "transaction:gone" }),
        [],
        [],
      ),
    ).toBeNull();
  });

  it("never resolves an item to itself", () => {
    const self = item({ id: "a", status: "duplicate", duplicateCaptureReviewItemId: "a" });
    expect(resolveDuplicateCounterpart(self, [], [self])).toBeNull();
  });
});

describe("diffCaptureFromOriginal", () => {
  it("reports nothing for an untouched capture", () => {
    expect(diffCaptureFromOriginal(item({ id: "a" }))).toEqual([]);
  });

  it("reports each field the user corrected", () => {
    const corrected = item({
      id: "a",
      payee: "Shoprite Lugogo",
      categoryId: "cat-household",
      originalAmount: 86_900,
      normalizedAmount: 86_900,
    });

    expect(diffCaptureFromOriginal(corrected)).toEqual([
      { field: "originalAmount", label: "Amount", from: 86_400, to: 86_900 },
      { field: "categoryId", label: "Category", from: "cat-groceries", to: "cat-household" },
      { field: "payee", label: "Payee", from: "Shoprite", to: "Shoprite Lugogo" },
    ]);
  });

  it("treats a fee added during review as a change from nothing", () => {
    expect(diffCaptureFromOriginal(item({ id: "a", feeAmount: 500 }))).toEqual([
      { field: "feeAmount", label: "Fee", from: undefined, to: 500 },
    ]);
  });
});
