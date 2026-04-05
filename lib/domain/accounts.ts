import type { Account } from "@/lib/types";

export type AccountTotals = {
  totalBalance: number;
  activeAccounts: number;
  accountsByType: Record<Account["type"], number>;
};

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
