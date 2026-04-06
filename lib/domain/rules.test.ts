import { describe, expect, it } from "vitest";

import { applyTransactionRules } from "@/lib/domain/rules";
import type { Transaction, TransactionRule } from "@/lib/types";

const transaction: Transaction = {
  id: "transaction:1",
  userId: "user:default",
  accountId: "account:bank",
  type: "expense",
  amount: 25_000,
  currency: "UGX",
  originalAmount: 25_000,
  occurredOn: "2026-04-06",
  categoryId: "category:misc",
  payee: "MTN MOMO charge",
  rawPayee: "MTN MOMO charge",
  reconciliationState: "parsed",
  source: "sms",
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
};

function buildRule(values: Partial<TransactionRule> & Pick<TransactionRule, "id" | "name" | "priority">): TransactionRule {
  return {
    userId: "user:default",
    enabled: true,
    autoMarkReviewed: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...values,
  };
}

describe("transaction rules", () => {
  it("applies the highest-priority matching rule first", () => {
    const match = applyTransactionRules(transaction, [
      buildRule({
        id: "rule:low",
        name: "Generic MTN",
        priority: 20,
        payeePattern: "mtn",
        effectCategoryId: "category:airtime",
      }),
      buildRule({
        id: "rule:high",
        name: "MOMO charge",
        priority: 10,
        payeePattern: "charge",
        effectCategoryId: "category:fees",
        effectPayee: "MTN Mobile Money",
        autoMarkReviewed: true,
      }),
    ]);

    expect(match?.rule.id).toBe("rule:high");
    expect(match?.proposedTransaction.categoryId).toBe("category:fees");
    expect(match?.proposedTransaction.payee).toBe("MTN Mobile Money");
    expect(match?.proposedTransaction.reconciliationState).toBe("reviewed");
  });

  it("ignores disabled rules", () => {
    const match = applyTransactionRules(transaction, [
      buildRule({
        id: "rule:disabled",
        name: "Disabled rule",
        priority: 1,
        enabled: false,
        payeePattern: "mtn",
      }),
    ]);

    expect(match).toBeNull();
  });
});
