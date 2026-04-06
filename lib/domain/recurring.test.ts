import { describe, expect, it } from "vitest";

import {
  buildSuggestedRecurringObligations,
  evaluateRecurringObligations,
} from "@/lib/domain/recurring";
import type { Account, RecurringObligation, Transaction } from "@/lib/types";

function buildTransaction(
  values: Partial<Transaction> & Pick<Transaction, "id" | "accountId" | "type" | "amount" | "occurredOn" | "categoryId">,
): Transaction {
  return {
    userId: "user:default",
    reconciliationState: "posted",
    source: "manual",
    currency: "UGX",
    originalAmount: Math.abs(values.amount),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...values,
  };
}

const obligation: RecurringObligation = {
  id: "obligation:rent",
  userId: "user:default",
  name: "Rent",
  categoryId: "category:rent",
  expectedAmount: 800_000,
  cadence: "monthly",
  dueDay: 5,
  payee: "landlord",
  type: "rent",
  status: "active",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

const debtAccount: Account = {
  id: "account:debt",
  userId: "user:default",
  name: "School fees loan",
  type: "debt",
  openingBalance: -1_200_000,
  balance: -900_000,
  debtPrincipal: 1_200_000,
  debtInterestRate: 18,
  debtInterestModel: "reducing_balance",
  debtLenderType: "sacco",
  debtRepaymentFrequency: "monthly",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

const saccoAccount: Account = {
  id: "account:sacco",
  userId: "user:default",
  name: "Teachers SACCO",
  type: "sacco",
  openingBalance: 0,
  balance: 120_000,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

describe("recurring obligations", () => {
  it("marks a due obligation as paid when a matching transaction exists", () => {
    const evaluations = evaluateRecurringObligations(
      [obligation],
      [
        buildTransaction({
          id: "tx:rent",
          accountId: "account:bank",
          type: "expense",
          amount: 800_000,
          occurredOn: "2026-04-05",
          categoryId: "category:rent",
          payee: "Landlord payment",
        }),
      ],
      "2026-04",
    );

    expect(evaluations[0].state).toBe("paid");
  });

  it("marks unmatched obligations as missing", () => {
    const evaluations = evaluateRecurringObligations([obligation], [], "2026-04");
    expect(evaluations[0].state).toBe("missing");
  });

  it("matches sacco contribution obligations against inbound transfer legs", () => {
    const evaluations = evaluateRecurringObligations(
      [
        {
          ...obligation,
          id: "obligation:sacco",
          type: "sacco_contribution",
          categoryId: "category:savings",
          linkedAccountId: "account:sacco",
          expectedAmount: 120_000,
          payee: "Teachers SACCO",
        },
      ],
      [
        buildTransaction({
          id: "tx:sacco-credit",
          accountId: "account:sacco",
          type: "transfer",
          amount: 120_000,
          occurredOn: "2026-04-06",
          categoryId: "category:transfer",
          payee: "Teachers SACCO",
        }),
      ],
      "2026-04",
    );

    expect(evaluations[0].state).toBe("paid");
  });

  it("builds suggested recurring obligations from debt repayment actions and sacco history", () => {
    const suggestions = buildSuggestedRecurringObligations(
      [debtAccount, saccoAccount],
      [
        buildTransaction({
          id: "tx:debt-payment",
          accountId: "account:debt",
          type: "debt_payment",
          amount: 180_000,
          occurredOn: "2026-03-27",
          categoryId: "category:debt",
          payee: "School fees loan",
        }),
        buildTransaction({
          id: "tx:sacco",
          accountId: "account:sacco",
          type: "transfer",
          amount: 120_000,
          occurredOn: "2026-03-28",
          categoryId: "category:transfer",
          payee: "Teachers SACCO",
        }),
      ],
      "avalanche",
      50_000,
    );

    expect(suggestions.some((obligation) => obligation.type === "loan_repayment")).toBe(true);
    expect(suggestions.some((obligation) => obligation.type === "sacco_contribution")).toBe(true);
  });
});
