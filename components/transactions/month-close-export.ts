// Builds the month-close CSV export. Pure so the format is unit-testable;
// the workspace hook only handles the browser download.

import { getSummaryForTransactions } from "@/lib/domain/summaries";
import type { Category, Transaction } from "@/lib/types";

export function buildMonthCloseCsv(
  transactions: Transaction[],
  categories: Category[],
  closePeriod: string,
): string {
  const periodTransactions = transactions.filter((transaction) =>
    transaction.occurredOn.startsWith(closePeriod),
  );
  const summary = getSummaryForTransactions(periodTransactions, categories);

  const csvLines = [
    ["Metric", "Value"].join(","),
    ["Opening balance", String(summary.openingBalance)].join(","),
    ["Inflow", String(summary.inflow)].join(","),
    ["Outflow", String(summary.outflow)].join(","),
    ["Saved", String(summary.savings)].join(","),
    ["Allocated savings", String(summary.allocatedSavings)].join(","),
    ["Net after savings", String(summary.net)].join(","),
    ["Movement", String(summary.movement)].join(","),
    ["Closing balance", String(summary.closingBalance)].join(","),
    "",
    ["Date", "Type", "Account", "Category", "Payee", "Amount", "State", "Note"].join(","),
    ...periodTransactions.map((transaction) =>
      [
        transaction.occurredOn,
        transaction.type,
        transaction.accountId,
        transaction.categoryId,
        transaction.payee ?? transaction.rawPayee ?? "",
        String(transaction.amount),
        transaction.reconciliationState,
        (transaction.note ?? "").replaceAll(",", " "),
      ].join(","),
    ),
  ];

  return csvLines.join("\n");
}
