import { isReservedAccountId, isReservedAccountName } from "@/lib/app-state/default-accounts";
import type { Account, Transaction } from "@/lib/types";

/**
 * Nothing cascades a delete, and the reporting paths silently skip transactions
 * whose account they cannot find — orphans vanish from the bands while sitting
 * in storage forever. So delete is only offered when there is nothing to
 * orphan; anything with history is archived or merged instead.
 */

export type DeleteVerdict = { allowed: true } | { allowed: false; reason: string };

export function countAccountTransactions(
  accountId: string,
  transactions: Transaction[],
): number {
  return transactions.filter((transaction) => transaction.accountId === accountId).length;
}

export function canDeleteAccount(
  account: Account,
  transactions: Transaction[],
): DeleteVerdict {
  if (isReservedAccountId(account.id)) {
    return {
      allowed: false,
      reason: `${account.name} is created for everyone and cannot be deleted. Archive it instead to hide it.`,
    };
  }

  const count = countAccountTransactions(account.id, transactions);
  if (count > 0) {
    return {
      allowed: false,
      reason:
        count === 1
          ? "This account has 1 transaction. Archive it, or merge it, so the record is not lost."
          : `This account has ${count} transactions. Archive it, or merge it, so the records are not lost.`,
    };
  }

  return { allowed: true };
}

export type MergePlan =
  | { blocked: string; transactions: [] }
  | { blocked?: undefined; transactions: Transaction[] };

/**
 * Re-points every record onto `target`, stamping the source account's name as
 * the payee because that is what a pool groups on. `rawPayee` is left alone: it
 * holds what was captured from an SMS, which is evidence rather than a key.
 */
export function planAccountMerge(
  source: Account,
  target: Account,
  transactions: Transaction[],
  timestamp: string,
): MergePlan {
  if (source.id === target.id) {
    return { blocked: "An account cannot be merged into itself.", transactions: [] };
  }
  if (isReservedAccountId(source.id)) {
    return {
      blocked: `${source.name} is created for everyone and cannot be merged away.`,
      transactions: [],
    };
  }
  if (source.type !== target.type) {
    return {
      blocked: `${source.name} and ${target.name} track opposite directions of money, so merging them would flip the sign on every record.`,
      transactions: [],
    };
  }
  // A pool balance cannot be attributed to any one person, so the portfolios
  // skip it — carrying one across would add money no row accounts for.
  if (source.openingBalance !== 0) {
    return {
      blocked: `${source.name} has an opening balance. Set it to zero and record that loan as a transaction first, or keep this account as its own ledger.`,
      transactions: [],
    };
  }

  const moved = transactions
    .filter((transaction) => transaction.accountId === source.id)
    .map((transaction) => ({
      ...transaction,
      accountId: target.id,
      payee: source.name,
      updatedAt: timestamp,
    }));

  return { transactions: moved };
}

export function findDuplicatePoolAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      !account.isArchived &&
      !isReservedAccountId(account.id) &&
      isReservedAccountName(account.name),
  );
}
