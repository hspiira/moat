import type { CaptureReviewSnapshot, TransactionRule } from "@/lib/types";

// A rule may approve captures unseen once it has agreed with you this many
// times running. Small enough to be reachable, large enough that one lucky
// match is not enough.
export const ACCEPTANCES_BEFORE_TRUSTED = 5;

export type RuleOutcome = "accepted" | "overridden";

type Judged = Pick<CaptureReviewSnapshot, "payee" | "categoryId" | "accountId" | "type">;

// The rule is applied on top of whatever you left, so a change on its own says
// nothing: correcting the parser is the rule doing its job. What counts against
// it is changing a field you had already put right yourself.
export function judgeRuleOutcome(params: {
  rule: TransactionRule;
  parsed: Judged;
  approved: Judged;
}): RuleOutcome {
  const { rule, parsed, approved } = params;

  const overrides: Array<[unknown, unknown, unknown]> = [
    [rule.effectPayee, parsed.payee, approved.payee],
    [rule.effectCategoryId, parsed.categoryId, approved.categoryId],
    [rule.effectAccountId, parsed.accountId, approved.accountId],
    [rule.effectTransactionType, parsed.type, approved.type],
  ];

  for (const [effect, asParsed, asApproved] of overrides) {
    if (effect === undefined) continue;
    const youChangedIt = asApproved !== asParsed;
    if (youChangedIt && effect !== asApproved) return "overridden";
  }

  return "accepted";
}

export function recordRuleOutcome(
  rule: TransactionRule,
  outcome: RuleOutcome,
  timestamp: string,
): TransactionRule {
  if (outcome === "overridden") {
    return {
      ...rule,
      timesAccepted: 0,
      timesOverridden: (rule.timesOverridden ?? 0) + 1,
      autoMarkReviewed: false,
      updatedAt: timestamp,
    };
  }

  return {
    ...rule,
    timesAccepted: (rule.timesAccepted ?? 0) + 1,
    updatedAt: timestamp,
  };
}

export function hasEarnedAutoApproval(rule: TransactionRule): boolean {
  return (
    !rule.autoMarkReviewed &&
    rule.enabled &&
    (rule.timesAccepted ?? 0) >= ACCEPTANCES_BEFORE_TRUSTED
  );
}
