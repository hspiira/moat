"use client";

import Link from "next/link";

import { formatMoneyShort } from "@/lib/currency";
import type { PlannedAgainstBudget } from "@/lib/domain/planned-against-budget";

export function AgainstBudgetNote({ rows }: { rows: PlannedAgainstBudget[] }) {
  if (rows.length === 0) return null;

  const short = rows.filter((row) => row.shortfall > 0);

  return (
    <div className="grid gap-1">
      {short.length > 0 ? (
        <p className="text-sm leading-6 text-foreground">
          This plan is {formatMoneyShort(short[0].shortfall)} more than you have left in{" "}
          <span className="font-medium">{short[0].categoryName}</span>
          {short.length > 1 ? `, and short in ${short.length - 1} other` : ""}
          {short.length > 2 ? " categories" : short.length === 2 ? " category" : ""}.
        </p>
      ) : null}

      <ul className="grid">
        {rows.map((row) => (
          <li key={row.categoryId} className="min-w-0">
            <Link
              href="/budgets"
              className="flex items-baseline justify-between gap-3 border-b border-border py-2 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {row.categoryName}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                <span className={row.shortfall > 0 ? "text-neg" : "text-foreground"}>
                  {formatMoneyShort(row.planned)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  of {formatMoneyShort(row.remaining)} left
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
