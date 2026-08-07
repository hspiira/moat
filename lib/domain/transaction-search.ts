import type { Account, Category, Transaction } from "@/lib/types";

/**
 * Free-text search over the ledger. Every word in the query must match
 * somewhere in the transaction — payee, note, category, account, or amount —
 * so "boda cash" narrows rather than widens.
 *
 * Amounts match on digits: "8000" finds USh 8,000 whether the user types
 * separators or not.
 */
export function searchTransactions(
  transactions: Transaction[],
  query: string,
  accounts: Account[],
  categories: Category[],
): Transaction[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return transactions;

  const accountNames = new Map(accounts.map((account) => [account.id, account.name.toLowerCase()]));
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name.toLowerCase()]),
  );

  return transactions.filter((transaction) => {
    const haystack = [
      transaction.payee?.toLowerCase(),
      transaction.rawPayee?.toLowerCase(),
      transaction.note?.toLowerCase(),
      accountNames.get(transaction.accountId),
      categoryNames.get(transaction.categoryId),
    ].filter((value): value is string => Boolean(value));

    const amountDigits = String(Math.abs(Math.round(transaction.amount)));

    return words.every((word) => {
      const wordDigits = word.replace(/[,._\s]/g, "");
      if (/^\d+$/.test(wordDigits) && amountDigits.includes(wordDigits)) {
        return true;
      }
      return haystack.some((value) => value.includes(word));
    });
  });
}
