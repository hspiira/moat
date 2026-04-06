"use client";

import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/currency";
import {
  buildDebtPayoffPlan,
  getDebtPortfolioSummary,
  type DebtPayoffPlan,
} from "@/lib/domain/debt";
import type { Account, Transaction } from "@/lib/types";
import { AmountIndicator } from "@/components/amount-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PlanCard({ title, plan, recommended }: { title: string; plan: DebtPayoffPlan; recommended: boolean }) {
  return (
    <div className={`grid gap-2 border px-4 py-4 ${recommended ? "border-primary/30 bg-primary/5" : "border-border/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">
            {plan.months !== null ? `${plan.months} months` : "Needs higher monthly budget"}
          </div>
        </div>
        {recommended ? (
          <div className="text-xs text-primary">Recommended</div>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">
        Monthly debt budget {formatMoney(plan.monthlyBudget, "UGX")}
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Total interest</span>
        <AmountIndicator tone="negative" sign="negative" value={formatMoney(plan.totalInterest, "UGX")} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Projected paid</span>
        <span className="text-foreground">{formatMoney(plan.totalPaid, "UGX")}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Order: {plan.payoffOrder.length > 0 ? plan.payoffOrder.join(" → ") : "No active debts"}
      </div>
      {plan.warnings.length > 0 ? (
        <div className="grid gap-1 text-xs text-destructive">
          {plan.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DebtPayoffPlanner({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState("0");
  const debtSummaries = useMemo(
    () => getDebtPortfolioSummary(accounts, transactions),
    [accounts, transactions],
  );
  const extraPayment = Number(extraMonthlyPayment) || 0;
  const snowballPlan = useMemo(
    () => buildDebtPayoffPlan(accounts, transactions, "snowball", extraPayment),
    [accounts, extraPayment, transactions],
  );
  const avalanchePlan = useMemo(
    () => buildDebtPayoffPlan(accounts, transactions, "avalanche", extraPayment),
    [accounts, extraPayment, transactions],
  );
  const recommended =
    avalanchePlan.months !== null &&
    (snowballPlan.months === null ||
      avalanchePlan.totalInterest <= snowballPlan.totalInterest)
      ? "avalanche"
      : "snowball";

  if (debtSummaries.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Debt payoff planner</CardTitle>
        <CardDescription>
          Compare a fast-win snowball against an interest-first avalanche using your current debt book.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-2">
            <Label htmlFor="extra-debt-payment">Extra monthly payment (UGX)</Label>
            <Input
              id="extra-debt-payment"
              inputMode="numeric"
              value={extraMonthlyPayment}
              onChange={(event) => setExtraMonthlyPayment(event.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              This is added on top of inferred minimum payments from your current debts.
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="border border-border/20 px-3 py-3">
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="mt-1 text-lg text-foreground">
                {formatMoney(
                  debtSummaries.reduce((sum, debt) => sum + debt.outstandingBalance, 0),
                  "UGX",
                )}
              </div>
            </div>
            <div className="border border-border/20 px-3 py-3">
              <div className="text-xs text-muted-foreground">Min monthly load</div>
              <div className="mt-1 text-lg text-foreground">
                {formatMoney(
                  debtSummaries.reduce((sum, debt) => sum + debt.inferredMinimumPayment, 0),
                  "UGX",
                )}
              </div>
            </div>
            <div className="border border-border/20 px-3 py-3">
              <div className="text-xs text-muted-foreground">Open debts</div>
              <div className="mt-1 text-lg text-foreground">{debtSummaries.length}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <PlanCard title="Snowball" plan={snowballPlan} recommended={recommended === "snowball"} />
          <PlanCard title="Avalanche" plan={avalanchePlan} recommended={recommended === "avalanche"} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setExtraMonthlyPayment("0")}
          >
            Reset extra payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
