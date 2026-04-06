import type { Transaction, TransactionRule } from "@/lib/types";

export type TransactionRuleMatch = {
  rule: TransactionRule;
  proposedTransaction: Transaction;
};

function includesPattern(value: string | undefined, pattern: string | undefined) {
  if (!pattern) return true;
  if (!value) return false;
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function matchesAmount(transaction: Transaction, pattern: string | undefined) {
  if (!pattern) return true;
  const numeric = Number(pattern);

  if (Number.isFinite(numeric)) {
    return Math.abs(transaction.amount) === Math.abs(numeric);
  }

  return String(Math.abs(transaction.amount)).includes(pattern);
}

function matchesRule(rule: TransactionRule, transaction: Transaction) {
  if (!rule.enabled) return false;
  if (rule.source && rule.source !== transaction.source) return false;
  if (rule.categoryId && rule.categoryId !== transaction.categoryId) return false;
  if (rule.accountId && rule.accountId !== transaction.accountId) return false;
  if (!includesPattern(transaction.rawPayee, rule.senderPattern)) return false;
  if (!includesPattern(transaction.payee ?? transaction.rawPayee, rule.payeePattern)) return false;
  if (!includesPattern(transaction.note, rule.keywordPattern)) return false;
  if (!matchesAmount(transaction, rule.amountPattern)) return false;

  return true;
}

export function applyTransactionRules(
  transaction: Transaction,
  rules: TransactionRule[],
): TransactionRuleMatch | null {
  const orderedRules = [...rules].sort((left, right) => {
    if (left.priority === right.priority) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.priority - right.priority;
  });

  const matchedRule = orderedRules.find((rule) => matchesRule(rule, transaction));

  if (!matchedRule) {
    return null;
  }

  return {
    rule: matchedRule,
    proposedTransaction: {
      ...transaction,
      payee: matchedRule.effectPayee ?? transaction.payee,
      categoryId: matchedRule.effectCategoryId ?? transaction.categoryId,
      accountId: matchedRule.effectAccountId ?? transaction.accountId,
      type: matchedRule.effectTransactionType ?? transaction.type,
      matchedRuleId: matchedRule.id,
      reconciliationState: matchedRule.autoMarkReviewed ? "reviewed" : transaction.reconciliationState,
      reviewedAt: matchedRule.autoMarkReviewed ? new Date().toISOString() : transaction.reviewedAt,
    },
  };
}
