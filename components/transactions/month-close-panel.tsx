"use client";

import Link from "next/link";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChevronRight,
  IconCopy,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

import type { MonthClose, Transaction } from "@/lib/types";
import type { MonthCloseEvaluation } from "@/lib/domain/reconciliation";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { getMonthCloseBlockers, getMonthCloseChecks } from "@/lib/domain/month-close-blockers";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatDate, formatMonthLabel } from "@/lib/format-date";
import type { Account } from "@/lib/types";

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
  onKeepDuplicates: (group: Transaction[]) => void;
};

const groupIcons = {
  unresolved: IconAlertTriangle,
  duplicate: IconCopy,
  obligation: IconCalendarEvent,
} as const;

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
  onKeepDuplicates,
}: Props) {
  const monthLabel = formatMonthLabel(period);
  const { groups, total } = getMonthCloseBlockers({ evaluation, recurringEvaluations });
  const checks = getMonthCloseChecks({ evaluation, recurringEvaluations });
  const isClosed = monthClose?.state === "closed";
  const checkedOn = monthClose?.closedAt ? formatDate(monthClose.closedAt) : null;
  const accountName = (id: string) => accounts.find((entry) => entry.id === id)?.name ?? "–";
  // What still fails is the work; what passed is reassurance. When there is
  // work, the reassurance folds away so the next issue is the first thing in
  // the list rather than the seventh.
  const failedChecks = checks.filter((check) => !check.passed);
  const passedChecks = checks.filter((check) => check.passed);
  const hasWork = failedChecks.length > 0;
  const blockedReason =
    isClosed || evaluation.isReadyToClose
      ? null
      : failedChecks.length > 0
        ? `Not ready yet: ${failedChecks.map((check) => check.label).join(", ")}.`
        : "Sort out the items above first.";

  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">{monthLabel}</h2>
        <p className="text-sm text-muted-foreground">
          {isClosed
            ? `You checked this month${checkedOn ? ` on ${checkedOn}` : ""}.`
            : total === 0
              ? "Everything here looks complete."
              : total === 1
                ? "1 thing to sort out. Until it is, this month's totals may be wrong."
                : `${total} things to sort out. Until they are, this month's totals may be wrong.`}
        </p>
      </div>

      <div className="grid min-w-0 gap-1.5 rounded-lg bg-muted/30 px-3 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          {passedChecks.length} of {checks.length} checks passed
        </p>

        <ul className="grid min-w-0 gap-1.5">
          {(hasWork ? failedChecks : checks).map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>

        {hasWork && passedChecks.length > 0 ? (
          <details className="group/passed min-w-0">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              <IconChevronRight
                aria-hidden
                className="size-3.5 transition-transform group-open/passed:rotate-90"
              />
              {passedChecks.length} passed
            </summary>
            <ul className="mt-1.5 grid min-w-0 gap-1.5">
              {passedChecks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </details>
        ) : null}
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
                              {entry.transaction.payee ?? entry.transaction.rawPayee ?? "No payee"}
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
                        <div key={entry.id} className="min-w-0 py-3">
                          <button
                            type="button"
                            onClick={() => onOpenTransaction(entry.transactions[0])}
                            className="flex w-full min-w-0 items-center gap-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-foreground">
                                {formatDate(entry.transactions[0].occurredOn)} ·{" "}
                                {entry.transactions.length} matching records
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-xs text-muted-foreground">
                                  {entry.transactions[0].payee ??
                                    entry.transactions[0].rawPayee ??
                                    "No payee"}
                                </span>
                                <Money
                                  amount={entry.transactions[0].amount}
                                  currency="UGX"
                                  tone="negative"
                                  signed
                                  className="shrink-0 text-sm font-semibold"
                                />
                              </div>
                            </div>
                            <IconChevronRight
                              aria-hidden
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => onKeepDuplicates(entry.transactions)}
                            className="mt-1 -ml-2 h-7 text-xs text-muted-foreground"
                          >
                            {entry.transactions.length > 2
                              ? "Not duplicates, keep all"
                              : "Not a duplicate, keep both"}
                          </Button>
                        </div>
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

      {/* Finishing the month is the point of the page. Taking a copy away is
          something else you might also want. */}
      <div className="grid justify-items-start gap-2 pt-1">
        <Button
          type="button"
          disabled={isSubmitting || isClosed || !evaluation.isReadyToClose}
          onClick={onClose}
          className="w-full sm:w-auto sm:px-6"
        >
          Mark month as checked
        </Button>
        {blockedReason ? (
          <p className="text-xs text-muted-foreground">{blockedReason}</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onExport}
          className="-ml-2 text-muted-foreground"
        >
          Download as spreadsheet
        </Button>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: { label: string; detail: string; passed: boolean } }) {
  return (
    <li className="flex min-w-0 items-start gap-2 text-sm">
      {check.passed ? (
        <IconCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-pos" />
      ) : (
        <IconAlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-neg" />
      )}
      <span className="min-w-0">
        <span className={check.passed ? "text-foreground" : "font-medium text-foreground"}>
          {check.label}
        </span>{" "}
        <span className="text-muted-foreground">· {check.detail}</span>
      </span>
    </li>
  );
}
