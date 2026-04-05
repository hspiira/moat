import type { Account, Transaction } from "@/lib/types";

export type AccountTotals = {
  totalBalance: number;
  activeAccounts: number;
  accountsByType: Record<Account["type"], number>;
};

export function normalizeOpeningBalance(
  type: Account["type"],
  amount: number,
): number {
  if (type === "debt") {
    return -Math.abs(amount);
  }

  return amount;
}

export function getAccountTotals(accounts: Account[]): AccountTotals {
  return accounts.reduce<AccountTotals>(
    (totals, account) => {
      if (account.isArchived) {
        return totals;
      }

      totals.totalBalance += account.balance;
      totals.activeAccounts += 1;
      totals.accountsByType[account.type] += 1;
      return totals;
    },
    {
      totalBalance: 0,
      activeAccounts: 0,
      accountsByType: {
        cash: 0,
        mobile_money: 0,
        bank: 0,
        sacco: 0,
        investment: 0,
        debt: 0,
      },
    },
  );
}

function getBalanceDelta(transaction: Transaction): number {
  switch (transaction.type) {
    case "income":
      return Math.abs(transaction.amount);
    case "expense":
    case "savings_contribution":
    case "debt_payment":
      return -Math.abs(transaction.amount);
    case "transfer":
      return transaction.amount;
    default:
      return 0;
  }
}

export function reconcileAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Account[] {
  const deltas = new Map<string, number>();

  for (const transaction of transactions) {
    deltas.set(
      transaction.accountId,
      (deltas.get(transaction.accountId) ?? 0) + getBalanceDelta(transaction),
    );
  }

  return accounts.map((account) => ({
    ...account,
    balance: account.openingBalance + (deltas.get(account.id) ?? 0),
  }));
}
