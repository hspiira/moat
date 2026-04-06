import type { Account, Transaction } from "@/lib/types";

export type AccountTotals = {
  totalBalance: number;
  activeAccounts: number;
  accountsByType: Record<Account["type"], number>;
};

export type AccountBalanceBreakdown = {
  openingBalance: number;
  inflow: number;
  outflow: number;
  savingsAllocations: number;
  transfers: number;
  movement: number;
  currentBalance: number;
};

export type LedgerRow = {
  id: string;
  date: string;
  type: Transaction["type"];
  payee?: string;
  categoryId: string;
  note?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  transaction: Transaction;
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

export function getTransactionBalanceDelta(transaction: Transaction): number {
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

function sortTransactionsForLedger(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => {
    if (left.occurredOn === right.occurredOn) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.occurredOn.localeCompare(right.occurredOn);
  });
}

export function getAccountBalanceBreakdown(
  account: Account,
  transactions: Transaction[],
): AccountBalanceBreakdown {
  const accountTransactions = transactions.filter(
    (transaction) => transaction.accountId === account.id,
  );

  const inflow = accountTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const outflow = accountTransactions
    .filter((transaction) => transaction.type === "expense" || transaction.type === "debt_payment")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const savingsAllocations = accountTransactions
    .filter((transaction) => transaction.type === "savings_contribution")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const transfers = accountTransactions
    .filter((transaction) => transaction.type === "transfer")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const movement = accountTransactions.reduce(
    (sum, transaction) => sum + getTransactionBalanceDelta(transaction),
    0,
  );

  return {
    openingBalance: account.openingBalance,
    inflow,
    outflow,
    savingsAllocations,
    transfers,
    movement,
    currentBalance: account.openingBalance + movement,
  };
}

export function reconcileAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Account[] {
  const deltas = new Map<string, number>();

  for (const transaction of transactions) {
    deltas.set(
      transaction.accountId,
      (deltas.get(transaction.accountId) ?? 0) + getTransactionBalanceDelta(transaction),
    );
  }

  return accounts.map((account) => ({
    ...account,
    balance: account.openingBalance + (deltas.get(account.id) ?? 0),
  }));
}

export function getLedgerRows(
  account: Account,
  transactions: Transaction[],
): LedgerRow[] {
  const accountTransactions = sortTransactionsForLedger(
    transactions.filter((transaction) => transaction.accountId === account.id),
  );

  let runningBalance = account.openingBalance;

  return accountTransactions.map((transaction) => {
    const delta = getTransactionBalanceDelta(transaction);
    runningBalance += delta;

    const magnitude = Math.abs(transaction.amount);
    const credit = delta > 0 ? magnitude : 0;
    const debit = delta < 0 ? magnitude : 0;

    return {
      id: transaction.id,
      date: transaction.occurredOn,
      type: transaction.type,
      payee: transaction.payee ?? transaction.rawPayee,
      categoryId: transaction.categoryId,
      note: transaction.note,
      debit,
      credit,
      runningBalance,
      transaction,
    };
  });
}
