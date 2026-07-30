"use client";

import Link from "next/link";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChevronRight,
  IconCopy,
} from "@tabler/icons-react";

import type { MonthClose, Transaction } from "@/lib/types";
import type { MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { getMonthCloseBlockers } from "@/lib/domain/month-close-blockers";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/format-date";
import type { Account } from "@/lib/types";

function formatMonthLabel(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? period
    : date.toLocaleDateString("en-UG", { month: "long", year: "numeric" });
}

type Props = {
  period: string;
  monthClose: MonthClose | null;
  evaluation: MonthCloseEvaluation;
  recurringEvaluations: RecurringEvaluation[];
  accounts: Account[];
  isSubmitting: boolean;
  onExport: () => void;
  onClose: () => void;
  onOpenTransaction: (transaction: Transaction) => void;
};

const groupIcons = {
  unresolved: IconAlertTriangle,
  duplicate: IconCopy,
  obligation: IconCalendarEvent,
} as const;

/** Label + count, with the reason underneath. */
function GroupHeader({
  icon: Icon,
  label,
  hint,
  count,
}: {
  icon: typeof IconAlertTriangle;
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <div className="flex items-start gap-2 pt-1">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-clay" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">
          {label}
          <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function BlockerRow({
  onClick,
  href,
  children,
}: {
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
  const className =
    "flex w-full min-w-0 items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * Month close: what stands between this period and being closed, and a way into
 * each of those things.
 *
 * The previous panel laid three lists out in `lg:grid-cols-3` on a mobile-first
 * app, printed unresolved records as a raw ISO date and an unformatted number
 * with no payee or currency, and silently cut each list at five. Nothing in it
 * was tappable, so it could tell you that you were blocked but not help.
 */
export function MonthClosePanel({
  period,
  monthClose,
  evaluation,
  recurringEvaluations,
  accounts,
  isSubmitting,
  onExport,
  onClose,
  onOpenTransaction,
}: Props) {
  const monthLabel = formatMonthLabel(period);
  const { groups, total } = getMonthCloseBlockers({ evaluation, recurringEvaluations });
  const isClosed = monthClose?.state === "closed";
  const accountName = (id: string) => accounts.find((entry) => entry.id === id)?.name ?? "—";

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-base leading-snug font-medium">{monthLabel}</h2>
        <p className="text-sm text-muted-foreground">
          {isClosed
            ? "Closed."
            : total === 0
              ? "Nothing left to clear."
              : `${total} to clear before closing.`}
        </p>
      </div>

      {groups.length > 0 ? (
        <div className="min-w-0 divide-y divide-border/60">
          {groups.map((group) => {
            const Icon = groupIcons[group.kind];
            return (
              <div key={group.kind} className="min-w-0 pb-1">
                <GroupHeader
                  icon={Icon}
                  label={group.label}
                  hint={group.hint}
                  count={group.count}
                />

                <div className="min-w-0 divide-y divide-border/40">
                  {group.kind === "unresolved"
                    ? group.entries.map((entry) => (
                        <BlockerRow
                          key={entry.id}
                          onClick={() => onOpenTransaction(entry.transaction)}
                        >
                          <div className="truncate text-sm text-foreground">
                            {formatDate(entry.transaction.occurredOn)} ·{" "}
                            {accountName(entry.transaction.accountId)}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.transaction.payee ?? entry.transaction.rawPayee ?? "Unlabeled"}
                            </span>
                            <Money
                              amount={entry.transaction.amount}
                              currency="UGX"
                              tone={entry.transaction.type === "income" ? "positive" : "negative"}
                              signed
                              className="shrink-0 text-sm font-semibold"
                            />
                          </div>
                        </BlockerRow>
                      ))
                    : null}

                  {group.kind === "duplicate"
                    ? group.entries.map((entry) => (
                        <BlockerRow
                          key={entry.id}
                          onClick={() => onOpenTransaction(entry.transactions[0])}
                        >
                          <div className="truncate text-sm text-foreground">
                            {formatDate(entry.transactions[0].occurredOn)} ·{" "}
                            {entry.transactions.length} matching records
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.transactions[0].payee ??
                                entry.transactions[0].rawPayee ??
                                "Unlabeled"}
                            </span>
                            <Money
                              amount={entry.transactions[0].amount}
                              currency="UGX"
                              tone="negative"
                              signed
                              className="shrink-0 text-sm font-semibold"
                            />
                          </div>
                        </BlockerRow>
                      ))
                    : null}

                  {group.kind === "obligation"
                    ? group.entries.map((entry) => (
                        <BlockerRow key={entry.id} href="/recurring">
                          <div className="truncate text-sm text-foreground">{entry.name}</div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.state === "missing" ? "No payment seen" : "Part paid"}
                            </span>
                            <span className="shrink-0 text-sm">
                              <Money
                                amount={entry.matchedAmount}
                                currency="UGX"
                                tone="muted"
                                className="text-sm"
                              />
                              <span className="text-muted-foreground"> / </span>
                              <Money
                                amount={entry.expectedAmount}
                                currency="UGX"
                                tone="neutral"
                                className="text-sm font-semibold"
                              />
                            </span>
                          </div>
                        </BlockerRow>
                      ))
                    : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onExport}>
          Export CSV
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting || isClosed || !evaluation.isReadyToClose}
          title={
            isClosed
              ? "This month is already closed."
              : evaluation.isReadyToClose
                ? undefined
                : "Clear the items above before closing."
          }
          onClick={onClose}
        >
          Close month
        </Button>
      </div>
    </div>
  );
}
