import { findMoneyDrift, hasMoneyDrift, type MoneyDriftPlan } from "@/lib/domain/money-drift";
import { repositories } from "@/lib/repositories/instance";

export async function repairMoneyDrift(
  userId: string,
  timestamp: string,
): Promise<MoneyDriftPlan["corrections"]> {
  const [transactions, accounts, goals, budgets] = await Promise.all([
    repositories.transactions.listByUser(userId),
    repositories.accounts.listByUser(userId),
    repositories.goals.listByUser(userId),
    repositories.budgets.listByUser(userId),
  ]);

  const plan = findMoneyDrift({ transactions, accounts, goals, budgets, timestamp });
  if (!hasMoneyDrift(plan)) {
    return [];
  }

  await Promise.all([
    ...plan.transactions.map((row) => repositories.transactions.upsert(row)),
    ...plan.accounts.map((row) => repositories.accounts.upsert(row)),
    ...plan.goals.map((row) => repositories.goals.upsert(row)),
    ...plan.budgets.map((row) => repositories.budgets.upsert(row)),
  ]);

  console.warn(
    `Moat: rounded ${plan.corrections.length} fractional amount(s) to whole shillings.`,
    plan.corrections,
  );

  return plan.corrections;
}
