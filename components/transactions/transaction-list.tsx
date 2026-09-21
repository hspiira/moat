"use client";

import {
  IconArrowDownRight,
  IconArrowsExchange,
  IconArrowUpRight,
  IconClock,
  IconPigMoney,
  IconReceipt2,
} from "@tabler/icons-react";

import { useState } from "react";

import { Money } from "@/components/ui/money";
import { counterpartiesById, partyNameFor } from "@/lib/domain/party-name";
import type { Account, Category, Counterparty, Transaction, TransactionType } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDayHeading } from "@/lib/format-date";
import { todayIso } from "@/lib/today";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { transactionTypeLabels } from "./transaction-form";
import { transferLegs } from "@/lib/domain/transaction-cascade";

type Props = {
  accounts: Account[];
  categories: Category[];
  counterparties?: Counterparty[];
  partyByGroup?: Map<string, string>;
  transactions: Transaction[];
  pendingSyncIds?: Set<string>;
  onOpenDetail: (transaction: Transaction) => void;
  caption?: string;
  // Day headings would fight an order that is not by day.
  grouped?: boolean;
  // A search that hid its own matches behind a closed day would be a search
  // that does not work, so filtering opens every day it returns.
  expandAll?: boolean;
};

type RowPresentation = {
  icon: typeof IconArrowUpRight;
  iconClass: string;
  tone: "positive" | "negative" | "neutral";
  signed: boolean;
};

const dotToneClass: Record<RowPresentation["tone"], string> = {
  positive: "bg-pos",
  negative: "bg-neg",
  neutral: "bg-muted-foreground/50",
};

const presentationByType: Record<TransactionType, RowPresentation> = {
  income: { icon: IconArrowDownRight, iconClass: "bg-pos/12 text-pos", tone: "positive", signed: true },
  expense: { icon: IconArrowUpRight, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  debt_payment: { icon: IconReceipt2, iconClass: "bg-neg/12 text-neg", tone: "negative", signed: true },
  savings_contribution: {
    icon: IconPigMoney,
    iconClass: "bg-pos/12 text-pos",
    tone: "positive",
    signed: false,
  },
  transfer: {
    icon: IconArrowsExchange,
    iconClass: "bg-muted text-muted-foreground",
    tone: "neutral",
    signed: true,
  },
};

// The chip reads "17 / Mon" the way a calendar tile does, so a day is found by
// its shape before its text is read. Built off the ISO string rather than a
// Date where only the two parts are wanted.
function dayContext(iso: string, today: string): string {
  if (iso === today) return "Today";
  const date = new Date(`${iso}T00:00:00`);
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  // todayIso reads the local date parts. toISOString would shift to UTC and
  // call the wrong day "Yesterday" for the last three hours of a Kampala night.
  if (iso === todayIso(yesterday)) return "Yesterday";
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-UG", {
    month: "long",
    year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  });
}

function dayChipParts(iso: string): { number: string; weekday: string } {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { number: iso.slice(-2), weekday: "" };
  return {
    number: String(date.getDate()),
    weekday: date.toLocaleDateString("en-UG", { weekday: "short" }),
  };
}

// What a collapsed day has to say for itself. In and out use the same
// definition as the month summary above the list, so a day and a month are
// not two different words for two different sums.
function daySummary(transactions: Transaction[], categories: Category[]) {
  const { inflow, outflow } = getSummaryForTransactions(transactions, categories);
  return { inflow, outflow, count: transactions.length };
}

function groupByDay(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const bucket = groups.get(transaction.occurredOn) ?? [];
    bucket.push(transaction);
    groups.set(transaction.occurredOn, bucket);
  }
  return [...groups.entries()];
}

export function TransactionList({
  accounts,
  categories,
  counterparties = [],
  partyByGroup,
  transactions,
  pendingSyncIds,
  onOpenDetail,
  caption = "Newest first. Transfers show as a matched pair.",
  grouped = true,
  expandAll = false,
}: Props) {
  const partyById = counterpartiesById(counterparties);
  const days = grouped
    ? groupByDay(transactions)
    : ([["all", transactions]] as Array<[string, Transaction[]]>);

  // One day open at a time, and it starts on today. Scrolling a month of
  // headings to reach the day you want beats scrolling a month of rows, and
  // the day you almost always want is the one you are in.
  const preferredDay = days.find(([day]) => day === todayIso())?.[0] ?? days[0]?.[0] ?? null;
  const [openDay, setOpenDay] = useState<string | null>(preferredDay);
  const [seenPreferred, setSeenPreferred] = useState(preferredDay);
  if (preferredDay !== seenPreferred) {
    setSeenPreferred(preferredDay);
    setOpenDay(preferredDay);
  }
  return (
    <Card>
      <CardHeader className="sr-only">
        <CardTitle>Ledger</CardTitle>
        <CardDescription>{caption}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-3">
        {transactions.length === 0 ? (
          <div className="px-4">
            <EmptyState>No transactions yet.</EmptyState>
          </div>
        ) : (
          <div className="grid gap-1">
            {days.map(([day, dayTransactions], dayIndex) => {
              const isOpen = !grouped || expandAll || openDay === day;
              const chip = grouped ? dayChipParts(day) : null;
              const totals = grouped ? daySummary(dayTransactions, categories) : null;

              return (
              <section key={day} className="relative min-w-0">
                {grouped && totals && chip ? (
                  <>
                    <h2>
                      <button
                        type="button"
                        onClick={() => setOpenDay(isOpen ? null : day)}
                        aria-expanded={isOpen}
                        aria-controls={`day-${day}`}
                        className={`flex w-full items-center gap-2.5 px-4 py-1.5 pr-5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                          isOpen ? "" : dayIndex % 2 === 0 ? "bg-muted/45" : "bg-muted/15"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`grid h-10 w-11 shrink-0 place-items-center rounded-md leading-none transition-colors ${
                            isOpen ? "bg-primary text-primary-foreground" : "bg-muted/70"
                          }`}
                        >
                          <span className="text-[13px] font-semibold tabular-nums">
                            {chip.number}
                          </span>
                          <span
                            className={`mt-px text-[9px] font-medium tracking-wide uppercase ${
                              isOpen ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {chip.weekday}
                          </span>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {dayContext(day, todayIso())}
                            <span className="sr-only"> · {formatDayHeading(day)}</span>
                          </span>
                          {/* The line that has to earn a closed day: how much
                              came in, how much went out, how many records. */}
                          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-muted-foreground">
                            <span className="tabular-nums">
                              {totals.count} {totals.count === 1 ? "record" : "records"}
                            </span>
                            {totals.inflow > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <Money
                                  amount={totals.inflow}
                                  currency="UGX"
                                  symbol="short"
                                  tone="positive"
                                  signed
                                />
                              </>
                            ) : null}
                            {totals.outflow > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <Money
                                  amount={totals.outflow}
                                  currency="UGX"
                                  symbol="short"
                                  tone="negative"
                                  signed
                                />
                              </>
                            ) : null}
                          </span>
                        </span>

                      </button>
                    </h2>
                    {/* Runs under the centre of the chip, so the dots on each
                        row below hang off the same line the day starts on. */}
                    {isOpen ? (
                      <span
                        aria-hidden
                        className="absolute top-13 bottom-2 left-[2.375rem] w-px bg-border"
                      />
                    ) : null}
                  </>
                ) : null}
                <ul id={grouped ? `day-${day}` : undefined} hidden={!isOpen}>
                  {dayTransactions.map((transaction) => {
              const account = accounts.find((a) => a.id === transaction.accountId);
              const category = categories.find((c) => c.id === transaction.categoryId);
              const isTransfer = transaction.type === "transfer";
              const legs = isTransfer ? transferLegs(transaction, transactions) : null;
              const route = legs
                ? `${accounts.find((a) => a.id === legs.source.accountId)?.name ?? "Unknown"} → ${
                    accounts.find((a) => a.id === legs.destination.accountId)?.name ?? "Unknown"
                  }`
                : null;
              const isLinkedFee = Boolean(transaction.feeParentId);
              const presentation = presentationByType[transaction.type];
              const Icon = presentation.icon;
              const title =
                partyNameFor(transaction, partyById, partyByGroup) ??
                category?.name ??
                transactionTypeLabels[transaction.type];

              return (
                <li key={transaction.id} className="transition-colors odd:bg-muted/15 hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(transaction)}
                    className={`relative flex w-full min-w-0 items-center gap-3 py-2 pr-5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      grouped ? "pl-[3.25rem]" : "pl-4"
                    }`}
                    aria-label={`Details for ${title}`}
                  >
                    {grouped ? (
                      // A dot on the rail rather than a disc in the row: the
                      // amount already carries the sign and the colour, so a
                      // second badge of the same news costs a row of height.
                      <span
                        aria-hidden
                        className={`absolute top-1/2 left-[2.1875rem] size-1.5 -translate-y-1/2 rounded-full ring-2 ring-background ${dotToneClass[presentation.tone]}`}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={`grid size-8 shrink-0 place-items-center rounded-full ${presentation.iconClass}`}
                      >
                        <Icon className="size-4" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm leading-tight font-medium text-foreground">
                        {title}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                        {grouped ? "" : `${formatDayHeading(transaction.occurredOn)} · `}
                        {route ?? account?.name ?? "–"}
                        {category && !isTransfer ? ` · ${category.name}` : ""}
                        {transaction.currency !== "UGX" ? ` · ${transaction.currency}` : ""}
                        {isLinkedFee ? " · Fee" : ""}
                      </div>
                    </div>

                    <span className="flex shrink-0 items-center gap-1.5">
                      {pendingSyncIds?.has(transaction.id) ? (
                        <IconClock
                          aria-hidden
                          className="size-3.5 text-muted-foreground"
                          title="Waiting to sync"
                        />
                      ) : null}
                      <Money
                        amount={transaction.amount}
                        currency="UGX"
                        symbol="short"
                        tone={presentation.tone}
                        signed={presentation.signed}
                        className="text-sm font-semibold tabular-nums sm:text-base"
                      />
                      {pendingSyncIds?.has(transaction.id) ? (
                        <span className="sr-only">Waiting to sync</span>
                      ) : null}
                    </span>
                  </button>

                </li>
              );
                  })}
                </ul>
              </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
