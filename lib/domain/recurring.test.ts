import { describe, expect, it } from "vitest";

import { evaluateRecurringObligations } from "@/lib/domain/recurring";
import type { RecurringObligation, Transaction } from "@/lib/types";

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
});
