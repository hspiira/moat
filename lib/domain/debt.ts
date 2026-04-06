import type { Account, Transaction } from "@/lib/types";

export type DebtSummary = {
  accountId: string;
  accountName: string;
  principal: number;
  outstandingBalance: number;
  interestRate: number;
  interestModel: Account["debtInterestModel"];
  lenderType?: Account["debtLenderType"];
  totalPaid: number;
  averagePayment: number;
  inferredMinimumPayment: number;
  estimatedMonthlyInterest: number;
  estimatedPayoffMonths: number | null;
  estimatedTotalCost: number | null;
  warning?: string;
};

export type DebtPayoffStrategy = "snowball" | "avalanche";

export type DebtPayoffPlan = {
  strategy: DebtPayoffStrategy;
  monthlyBudget: number;
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  payoffOrder: string[];
  warnings: string[];
};

function monthsBetween(startDate: string, endDate: Date) {
  const start = new Date(`${startDate}T00:00:00`);
  return Math.max(
    0,
    (endDate.getFullYear() - start.getFullYear()) * 12 +
      (endDate.getMonth() - start.getMonth()),
  );
}

function getMonthlyInterest(
  principal: number,
  outstandingBalance: number,
  interestRate: number,
  interestModel: Account["debtInterestModel"] = "reducing_balance",
) {
  if (interestRate <= 0 || outstandingBalance <= 0) {
    return 0;
  }

  if (interestModel === "flat") {
    return (principal * interestRate) / 100 / 12;
  }

  return (outstandingBalance * interestRate) / 100 / 12;
}

function inferMinimumPayment(account: Account, outstandingBalance: number, averagePayment: number) {
  const interestOnly = getMonthlyInterest(
    Math.abs(account.debtPrincipal ?? outstandingBalance),
    outstandingBalance,
    account.debtInterestRate ?? 0,
    account.debtInterestModel,
  );

  if (averagePayment > 0) {
    return Math.max(averagePayment, interestOnly);
  }

  if (account.debtTermMonths && account.debtStartDate) {
    const elapsedMonths = monthsBetween(account.debtStartDate, new Date());
    const remainingMonths = Math.max(1, account.debtTermMonths - elapsedMonths);
    return Math.max(outstandingBalance / remainingMonths + interestOnly, interestOnly);
  }

  return Math.max(outstandingBalance * 0.03 + interestOnly, interestOnly);
}

export function getDebtPayments(account: Account, transactions: Transaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.accountId === account.id && transaction.type === "debt_payment",
  );
}

export function getDebtSummary(account: Account, transactions: Transaction[]): DebtSummary | null {
  if (account.type !== "debt") {
    return null;
  }

  const principal = Math.abs(account.debtPrincipal ?? account.openingBalance ?? 0);
  const interestRate = account.debtInterestRate ?? 0;
  const payments = getDebtPayments(account, transactions);
  const totalPaid = payments.reduce((sum, payment) => sum + Math.abs(payment.amount), 0);
  const outstandingBalance = Math.max(0, Math.abs(account.balance));
  const averagePayment = payments.length > 0 ? totalPaid / payments.length : 0;
  const estimatedMonthlyInterest = getMonthlyInterest(
    principal,
    outstandingBalance,
    interestRate,
    account.debtInterestModel,
  );
  const inferredMinimumPayment = inferMinimumPayment(
    account,
    outstandingBalance,
    averagePayment,
  );

  let estimatedPayoffMonths: number | null = null;
  let warning: string | undefined;

  if (outstandingBalance === 0) {
    estimatedPayoffMonths = 0;
  } else if (inferredMinimumPayment > estimatedMonthlyInterest) {
    estimatedPayoffMonths = Math.ceil(
      outstandingBalance / (inferredMinimumPayment - estimatedMonthlyInterest),
    );
  } else {
    warning = "Current payments are not enough to reduce principal.";
  }

  const estimatedTotalCost =
    estimatedPayoffMonths !== null
      ? totalPaid + estimatedPayoffMonths * inferredMinimumPayment
      : null;

  return {
    accountId: account.id,
    accountName: account.name,
    principal,
    outstandingBalance,
    interestRate,
    interestModel: account.debtInterestModel ?? "reducing_balance",
    lenderType: account.debtLenderType,
    totalPaid,
    averagePayment,
    inferredMinimumPayment,
    estimatedMonthlyInterest,
    estimatedPayoffMonths,
    estimatedTotalCost,
    warning,
  };
}

export function getDebtPortfolioSummary(accounts: Account[], transactions: Transaction[]) {
  return accounts
    .map((account) => getDebtSummary(account, transactions))
    .filter((summary): summary is DebtSummary => Boolean(summary))
    .filter((summary) => summary.outstandingBalance > 0);
}

export function buildDebtPayoffPlan(
  accounts: Account[],
  transactions: Transaction[],
  strategy: DebtPayoffStrategy,
  extraMonthlyPayment: number,
): DebtPayoffPlan {
  const summaries = getDebtPortfolioSummary(accounts, transactions);

  if (summaries.length === 0) {
    return {
      strategy,
      monthlyBudget: 0,
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffOrder: [],
      warnings: [],
    };
  }

  const working = summaries.map((summary) => ({
    ...summary,
    remaining: summary.outstandingBalance,
  }));
  const monthlyBudget =
    working.reduce((sum, debt) => sum + debt.inferredMinimumPayment, 0) +
    Math.max(0, extraMonthlyPayment);

  const sortDebts = () =>
    [...working]
      .filter((debt) => debt.remaining > 0.01)
      .sort((left, right) => {
        if (strategy === "avalanche" && left.interestRate !== right.interestRate) {
          return right.interestRate - left.interestRate;
        }
        if (strategy === "snowball" && left.remaining !== right.remaining) {
          return left.remaining - right.remaining;
        }
        return left.accountName.localeCompare(right.accountName);
      });

  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  const payoffOrder: string[] = [];
  const warnings = working
    .filter((debt) => debt.warning)
    .map((debt) => `${debt.accountName}: ${debt.warning}`);

  while (working.some((debt) => debt.remaining > 0.01) && months < 600) {
    months += 1;
    const ordered = sortDebts();

    for (const debt of ordered) {
      const monthlyInterest = getMonthlyInterest(
        debt.principal,
        debt.remaining,
        debt.interestRate,
        debt.interestModel,
      );
      debt.remaining += monthlyInterest;
      totalInterest += monthlyInterest;
    }

    let extraPool = Math.max(0, extraMonthlyPayment);

    for (const debt of ordered) {
      if (debt.remaining <= 0.01) continue;

      const payment = Math.min(debt.remaining, debt.inferredMinimumPayment + extraPool);
      const minimumUsed = Math.min(payment, debt.inferredMinimumPayment);
      extraPool = Math.max(0, extraPool - Math.max(0, payment - minimumUsed));
      debt.remaining = Math.max(0, debt.remaining - payment);
      totalPaid += payment;

      if (debt.remaining <= 0.01 && !payoffOrder.includes(debt.accountName)) {
        payoffOrder.push(debt.accountName);
        extraPool += Math.max(0, debt.inferredMinimumPayment - minimumUsed);
      }
    }
  }

  return {
    strategy,
    monthlyBudget,
    months: working.some((debt) => debt.remaining > 0.01) ? null : months,
    totalInterest,
    totalPaid,
    payoffOrder,
    warnings,
  };
}
