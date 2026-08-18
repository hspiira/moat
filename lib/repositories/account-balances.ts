import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { repositories } from "@/lib/repositories/instance";

export async function persistReconciledBalances(userId: string): Promise<void> {
  const [accounts, transactions] = await Promise.all([
    repositories.accounts.listByUser(userId),
    repositories.transactions.listByUser(userId),
  ]);
  const stored = new Map(accounts.map((account) => [account.id, account.balance]));
  const changed = reconcileAccountBalances(accounts, transactions).filter(
    (account) => stored.get(account.id) !== account.balance,
  );
  await Promise.all(changed.map((account) => repositories.accounts.upsert(account)));
}
