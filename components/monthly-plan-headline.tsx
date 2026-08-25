"use client";

import { useMemo } from "react";

import { getBudgetEnvelopes, getBudgetFundingCapacity } from "@/lib/domain/budgets";
import { summariseMonthlyPlan } from "@/lib/domain/monthly-plan";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { formatMoney, formatMoneyShort } from "@/lib/currency";
import type { BudgetTarget, Category, Transaction } from "@/lib/types";

/**
 * What the month has claimed on the money coming in, from both halves of the
 * plan at once. Two separate totals lower down answer smaller questions; this
 * answers whether the month adds up.
 */
export function MonthlyPlanHeadline({
  month,
  budgets,
  categories,
  transactions,
  evaluations,
}: {
  month: string;
  budgets: BudgetTarget[];
  categories: Category[];
  transactions: Transaction[];
  evaluations: RecurringEvaluation[];
}) {
  const summary = useMemo(() => {
    const monthTransactions = transactions.filter((entry) =>
      entry.occurredOn.startsWith(month),
    );
    return summariseMonthlyPlan({
      envelopes: getBudgetEnvelopes(budgets, categories, monthTransactions),
      evaluations,
      income: getBudgetFundingCapacity(budgets, monthTransactions).inflow,
    });
  }, [budgets, categories, evaluations, month, transactions]);

  if (summary.spokenFor === 0 && summary.income === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing planned for this month yet. Add the bills that repeat and a limit for
        anything you want to cap.
      </p>
    );
  }

  const parts = [
    summary.budgeted > 0 ? `${formatMoneyShort(summary.budgeted)} budgeted` : null,
    summary.billsOutstanding > 0
      ? `${formatMoneyShort(summary.billsOutstanding)} still to pay in bills`
      : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-1">
      <p className="text-sm text-muted-foreground">Spoken for this month</p>
      <p className="font-display text-4xl font-semibold tracking-tight text-foreground">
        {formatMoney(summary.spokenFor)}
      </p>
      <p className="text-sm text-muted-foreground">
        {parts.join(" · ")}
        {summary.income > 0 ? (
          <>
            {parts.length ? ". " : ""}
            {summary.overcommitted ? (
              <span className="text-neg">
                {formatMoneyShort(Math.abs(summary.unspokenFor))} more than has come in.
              </span>
            ) : (
              <>
                {formatMoneyShort(summary.unspokenFor)} of this month&apos;s income is not
                spoken for.
              </>
            )}
          </>
        ) : null}
      </p>
      {summary.billsOutstanding > summary.billsOutsideBudgets ? (
        <p className="text-xs text-muted-foreground">
          Bills already covered by a budget are counted once.
        </p>
      ) : null}
    </div>
  );
}
