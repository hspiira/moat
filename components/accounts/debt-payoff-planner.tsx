"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { formatMoney } from "@/lib/currency";
import {
  buildDebtPayoffPlan,
  getDebtRepaymentActions,
  getDebtPortfolioSummary,
  type DebtPayoffStrategy,
  type DebtPayoffPlan,
} from "@/lib/domain/debt";
import {
  readDebtPlannerSettings,
  saveDebtPlannerSettings,
} from "@/lib/preferences/debt-planner";
import type { Account, Transaction } from "@/lib/types";
import { AmountIndicator } from "@/components/amount-indicator";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { optionsFromRecord } from "@/lib/select-options";

const strategyLabels: Record<DebtPayoffStrategy, string> = {
  avalanche: "Avalanche",
  snowball: "Snowball",
};

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
  const [settings, setSettings] = useState(() => readDebtPlannerSettings());
  const debtSummaries = useMemo(
    () => getDebtPortfolioSummary(accounts, transactions),
    [accounts, transactions],
  );
  const extraPayment = settings.extraMonthlyPayment;
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
  const selectedPlan = settings.strategy === "avalanche" ? avalanchePlan : snowballPlan;
  const actions = useMemo(
    () => getDebtRepaymentActions(accounts, transactions, settings.strategy, extraPayment),
    [accounts, extraPayment, settings.strategy, transactions],
  );

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
          <div className="grid gap-3">
            <SelectField
              id="debt-strategy"
              label="Preferred strategy"
              value={settings.strategy}
              options={optionsFromRecord(strategyLabels)}
              onValueChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  strategy: value as DebtPayoffStrategy,
                }))
              }
            />
            <InputField
              id="extra-debt-payment"
              label="Extra monthly payment (UGX)"
              inputMode="numeric"
              value={String(settings.extraMonthlyPayment)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  extraMonthlyPayment: Number(event.target.value) || 0,
                }))
              }
              hint="This is added on top of inferred minimum payments from your current debts."
            />
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

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-foreground">Next repayment actions</div>
              <div className="text-xs text-muted-foreground">
                Based on the saved {settings.strategy} strategy.
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Current plan: {selectedPlan.months !== null ? `${selectedPlan.months} months` : "needs more payment"}
            </div>
          </div>
          <div className="grid gap-2">
            {actions.map((action) => (
              <div key={action.accountId} className="border border-border/20 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-foreground">
                      {action.priority}. {action.accountName}
                    </div>
                    <div className="text-xs text-muted-foreground">{action.reason}</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/transactions?type=debt_payment&accountId=${encodeURIComponent(
                        action.accountId,
                      )}&amount=${Math.round(action.recommendedPayment)}&payee=${encodeURIComponent(
                        action.accountName,
                      )}`}
                    >
                      Record payment
                    </Link>
                  </Button>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <div>Minimum {formatMoney(action.minimumPayment, "UGX")}</div>
                  <div>Extra {formatMoney(action.extraAllocation, "UGX")}</div>
                  <div>Recommended {formatMoney(action.recommendedPayment, "UGX")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => saveDebtPlannerSettings(settings)}
          >
            Save strategy
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const next = { strategy: "avalanche" as const, extraMonthlyPayment: 0 };
              setSettings(next);
              saveDebtPlannerSettings(next);
            }}
          >
            Reset planner
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
