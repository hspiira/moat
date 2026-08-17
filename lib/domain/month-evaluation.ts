import {
  buildSuggestedRecurringObligations,
  evaluateRecurringObligations,
} from "@/lib/domain/recurring";
import { evaluateMonthClose, type MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type {
  Account,
  Category,
  RecurringObligation,
  Transaction,
} from "@/lib/types";
import type { readDebtPlannerSettings } from "@/lib/preferences/debt-planner";

export type MonthEvaluationInput = {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  obligations: RecurringObligation[];
  closePeriod: string;
  debtPlannerSettings: ReturnType<typeof readDebtPlannerSettings>;
};

export function evaluateMonth(input: MonthEvaluationInput): MonthCloseEvaluation {
  const { accounts, transactions, categories, obligations, closePeriod, debtPlannerSettings } =
    input;

  const recurring = evaluateRecurringObligations(
    [
      ...obligations,
      ...buildSuggestedRecurringObligations(
        accounts,
        transactions,
        debtPlannerSettings.strategy,
        debtPlannerSettings.extraMonthlyPayment,
      ),
    ],
    transactions,
    closePeriod,
  );

  return evaluateMonthClose(
    transactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
    categories,
    recurring.map((entry) => ({
      obligation: entry.obligation,
      status: entry.state === "paid" ? "paid" : entry.state === "partial" ? "partial" : "missing",
    })),
  );
}
