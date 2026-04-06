import { describe, expect, it } from "vitest";

import {
  buildDebtPayoffPlan,
  getDebtRepaymentActions,
  getDebtSummary,
} from "@/lib/domain/debt";
import type { Account, Transaction } from "@/lib/types";

const accounts: Account[] = [
  {
    id: "debt:a",
    userId: "user:1",
    name: "SACCO loan",
    type: "debt",
    openingBalance: -1000000,
    balance: -800000,
    debtPrincipal: 1000000,
    debtInterestRate: 12,
    debtInterestModel: "reducing_balance",
    debtLenderType: "sacco",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "debt:b",
    userId: "user:1",
    name: "Device loan",
    type: "debt",
    openingBalance: -500000,
    balance: -300000,
    debtPrincipal: 500000,
    debtInterestRate: 24,
    debtInterestModel: "flat",
    debtLenderType: "microfinance",
    isArchived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "tx:1",
    userId: "user:1",
    accountId: "debt:a",
    type: "debt_payment",
    amount: 150000,
    currency: "UGX",
    originalAmount: 150000,
    occurredOn: "2026-03-05",
    categoryId: "cat:debt",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-03-05T00:00:00.000Z",
    updatedAt: "2026-03-05T00:00:00.000Z",
  },
  {
    id: "tx:2",
    userId: "user:1",
    accountId: "debt:b",
    type: "debt_payment",
    amount: 70000,
    currency: "UGX",
    originalAmount: 70000,
    occurredOn: "2026-03-06",
    categoryId: "cat:debt",
    reconciliationState: "posted",
    source: "manual",
    createdAt: "2026-03-06T00:00:00.000Z",
    updatedAt: "2026-03-06T00:00:00.000Z",
  },
];

describe("debt domain", () => {
  it("builds a debt summary with inferred payment and payoff estimate", () => {
    const summary = getDebtSummary(accounts[0], transactions);

    expect(summary).not.toBeNull();
    expect(summary?.outstandingBalance).toBe(800000);
    expect(summary?.averagePayment).toBe(150000);
    expect(summary?.inferredMinimumPayment).toBeGreaterThanOrEqual(150000);
    expect(summary?.estimatedPayoffMonths).not.toBeNull();
  });

  it("compares snowball and avalanche payoff plans", () => {
    const snowball = buildDebtPayoffPlan(accounts, transactions, "snowball", 50000);
    const avalanche = buildDebtPayoffPlan(accounts, transactions, "avalanche", 50000);

    expect(snowball.months).not.toBeNull();
    expect(avalanche.months).not.toBeNull();
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
    expect(snowball.payoffOrder.length).toBe(2);
    expect(avalanche.payoffOrder.length).toBe(2);
  });

  it("builds repayment actions in the selected strategy order", () => {
    const snowballActions = getDebtRepaymentActions(accounts, transactions, "snowball", 50000);
    const avalancheActions = getDebtRepaymentActions(accounts, transactions, "avalanche", 50000);

    expect(snowballActions[0].accountName).toBe("Device loan");
    expect(snowballActions[0].extraAllocation).toBe(50000);
    expect(avalancheActions[0].accountName).toBe("Device loan");
    expect(avalancheActions[0].recommendedPayment).toBeGreaterThan(
      avalancheActions[0].minimumPayment,
    );
  });
});
