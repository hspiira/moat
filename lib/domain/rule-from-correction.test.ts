import { describe, expect, it } from "vitest";

import { buildRuleFromCorrection } from "@/lib/domain/rule-from-correction";
import type { CaptureReviewSnapshot, CorrectionLog } from "@/lib/types";

function snapshot(overrides: Partial<CaptureReviewSnapshot> = {}): CaptureReviewSnapshot {
  return {
    accountId: "account:momo",
    occurredOn: "2026-04-08",
    originalAmount: 3_000,
    currency: "UGX",
    normalizedAmount: 3_000,
    type: "expense",
    categoryId: "category:uncategorised",
    payee: "MTNMOBILEMONEY",
    note: "",
    confidenceScore: 0.6,
    issues: [],
    fieldWarnings: [],
    ...overrides,
  };
}

function correction(
  original: Partial<CaptureReviewSnapshot>,
  approved: Partial<CaptureReviewSnapshot>,
): CorrectionLog {
  return {
    id: "correction:1",
    userId: "user:default",
    reviewItemId: "review:1",
    envelopeId: "envelope:1",
    source: "sms",
    confidenceScore: 0.6,
    originalSnapshot: snapshot(original),
    approvedSnapshot: snapshot(approved),
    createdAt: "2026-04-08T10:00:00.000Z",
  };
}

describe("buildRuleFromCorrection", () => {
  it("turns a renamed payee into a rule that matches what the parser read", () => {
    const rule = buildRuleFromCorrection(correction({}, { payee: "MTN airtime" }));

    expect(rule?.payeePattern).toBe("MTNMOBILEMONEY");
    expect(rule?.effectPayee).toBe("MTN airtime");
    expect(rule?.source).toBe("sms");
  });

  it("carries over a corrected category", () => {
    const rule = buildRuleFromCorrection(
      correction({}, { categoryId: "category:airtime" }),
    );

    expect(rule?.effectCategoryId).toBe("category:airtime");
    expect(rule?.effectPayee).toBeUndefined();
  });

  it("never approves later captures on its own", () => {
    const rule = buildRuleFromCorrection(correction({}, { payee: "MTN airtime" }));

    expect(rule?.autoMarkReviewed).toBe(false);
  });

  it("offers no rule when nothing useful changed", () => {
    expect(buildRuleFromCorrection(correction({}, {}))).toBeNull();
  });

  it("offers no rule when the parser read no payee to match on", () => {
    expect(
      buildRuleFromCorrection(correction({ payee: "  " }, { payee: "MTN airtime" })),
    ).toBeNull();
  });
});
