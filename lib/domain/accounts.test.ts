import { describe, expect, it } from "vitest";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import type { Account, Transaction } from "@/lib/types";

const account: Account = {
  id: "account:wallet",
  userId: "user:default",
  name: "Wallet",
  type: "cash",
  openingBalance: 100_000,
  balance: 100_000,
  isArchived: false,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

describe("reconcileAccountBalances", () => {
  it("applies income and spending movements to the opening balance", () => {
    const transactions: Transaction[] = [
      {
        id: "tx:salary",
        userId: "user:default",
        accountId: account.id,
        type: "income",
        amount: 50_000,
        occurredOn: "2026-04-05",
        categoryId: "category:salary",
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-05T00:00:00.000Z",
      },
      {
        id: "tx:food",
        userId: "user:default",
        accountId: account.id,
        type: "expense",
        amount: 10_000,
        occurredOn: "2026-04-06",
        categoryId: "category:food",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
    ];

    const [reconciled] = reconcileAccountBalances([account], transactions);

    expect(reconciled.balance).toBe(140_000);
  });

  it("treats paired transfer records as directional balance movements", () => {
    const transactions: Transaction[] = [
      {
        id: "tx:transfer-out",
        userId: "user:default",
        accountId: account.id,
        type: "transfer",
        amount: -25_000,
        occurredOn: "2026-04-07",
        categoryId: "category:transfers",
        transferGroupId: "transfer:1",
        createdAt: "2026-04-07T00:00:00.000Z",
        updatedAt: "2026-04-07T00:00:00.000Z",
      },
    ];

    const [reconciled] = reconcileAccountBalances([account], transactions);

    expect(reconciled.balance).toBe(75_000);
  });
});
