import { describe, expect, it } from "vitest";

import {
  ACCEPTANCES_BEFORE_TRUSTED,
  hasEarnedAutoApproval,
  judgeRuleOutcome,
  recordRuleOutcome,
} from "@/lib/domain/rule-trust";
import type { TransactionRule } from "@/lib/types";

const STAMP = "2026-08-22T10:00:00.000Z";

function rule(overrides: Partial<TransactionRule> = {}): TransactionRule {
  return {
    id: "rule:1",
    userId: "user:default",
    name: "Fix MTNMOBILEMONEY",
    enabled: true,
    priority: 100,
    payeePattern: "MTNMOBILEMONEY",
    effectPayee: "MTN airtime",
    effectCategoryId: "category:airtime",
    autoMarkReviewed: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

const parsed = {
  payee: "MTNMOBILEMONEY",
  categoryId: "category:uncategorised",
  accountId: "account:momo",
  type: "expense" as const,
};

describe("judgeRuleOutcome", () => {
  it("counts correcting the parser as the rule doing its job", () => {
    expect(judgeRuleOutcome({ rule: rule(), parsed, approved: parsed })).toBe("accepted");
  });

  it("counts agreeing with a fix you made yourself as accepted", () => {
    expect(
      judgeRuleOutcome({
        rule: rule(),
        parsed,
        approved: { ...parsed, payee: "MTN airtime", categoryId: "category:airtime" },
      }),
    ).toBe("accepted");
  });

  it("counts overriding a fix you made yourself as getting it wrong", () => {
    expect(
      judgeRuleOutcome({
        rule: rule(),
        parsed,
        approved: { ...parsed, payee: "Airtel airtime" },
      }),
    ).toBe("overridden");
  });

  it("says nothing about a field the rule does not set", () => {
    expect(
      judgeRuleOutcome({
        rule: rule({ effectPayee: undefined, effectCategoryId: undefined }),
        parsed,
        approved: { ...parsed, payee: "Someone else" },
      }),
    ).toBe("accepted");
  });

  it("judges the category the same way as the payee", () => {
    expect(
      judgeRuleOutcome({
        rule: rule(),
        parsed,
        approved: { ...parsed, categoryId: "category:food" },
      }),
    ).toBe("overridden");
  });
});

describe("recordRuleOutcome", () => {
  it("counts up when the rule agreed with you", () => {
    expect(recordRuleOutcome(rule({ timesAccepted: 2 }), "accepted", STAMP)).toMatchObject({
      timesAccepted: 3,
    });
  });

  it("starts the count again when the rule got it wrong", () => {
    expect(recordRuleOutcome(rule({ timesAccepted: 4 }), "overridden", STAMP)).toMatchObject({
      timesAccepted: 0,
      timesOverridden: 1,
    });
  });

  it("stops a rule approving unseen the moment it gets one wrong", () => {
    expect(
      recordRuleOutcome(rule({ autoMarkReviewed: true, timesAccepted: 9 }), "overridden", STAMP)
        .autoMarkReviewed,
    ).toBe(false);
  });

  it("leaves an approving rule alone while it keeps agreeing", () => {
    expect(
      recordRuleOutcome(rule({ autoMarkReviewed: true }), "accepted", STAMP).autoMarkReviewed,
    ).toBe(true);
  });
});

describe("hasEarnedAutoApproval", () => {
  it("is not earned before enough agreements", () => {
    expect(
      hasEarnedAutoApproval(rule({ timesAccepted: ACCEPTANCES_BEFORE_TRUSTED - 1 })),
    ).toBe(false);
  });

  it("is earned once the agreements are there", () => {
    expect(hasEarnedAutoApproval(rule({ timesAccepted: ACCEPTANCES_BEFORE_TRUSTED }))).toBe(true);
  });

  it("is not offered again to a rule that already approves", () => {
    expect(
      hasEarnedAutoApproval(rule({ timesAccepted: 20, autoMarkReviewed: true })),
    ).toBe(false);
  });

  it("is not offered for a rule that is switched off", () => {
    expect(hasEarnedAutoApproval(rule({ timesAccepted: 20, enabled: false }))).toBe(false);
  });

  it("counts an untouched rule as having no agreements, not as trusted", () => {
    expect(hasEarnedAutoApproval(rule())).toBe(false);
  });
});
