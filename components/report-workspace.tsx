"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { usePersistedSelection } from "@/components/hooks/use-persisted-selection";

import { CostOfMoving } from "@/components/report/cost-of-moving";
import { DayTransactions } from "@/components/report/day-transactions";
import { MoneyCalendar } from "@/components/report/money-calendar";
import { PositionChart } from "@/components/report/position-chart";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { AmountIndicator } from "@/components/amount-indicator";
import { DashboardTopSpendingCategories } from "@/components/dashboard/dashboard-sections";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import {
  buildDailyNetCalendar,
  buildPositionSeries,
  defaultCalendarDay,
  getAllocation,
  getFlowBreakdown,
  transactionsOnDay,
} from "@/lib/domain/report";
import { repositories } from "@/lib/repositories/instance";
import { todayIso } from "@/lib/today";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type WindowDays = (typeof WINDOWS)[number]["days"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(year, monthIndex - 1 + amount, 1);
  return monthKey(shifted);
}

function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function ReportWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = usePersistedSelection<WindowDays>(
    "moat.report-window",
    30,
    (value): value is WindowDays => value === 7 || value === 30 || value === 90,
  );
  const [month, setMonth] = useState(() => monthKey(new Date()));

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const nextProfile = await repositories.userProfile.get();
          setProfile(nextProfile);
          if (!nextProfile) return;

          const [storedAccounts, storedTransactions, storedCategories] = await Promise.all([
            repositories.accounts.listByUser(nextProfile.id),
            repositories.transactions.listByUser(nextProfile.id),
            repositories.categories.listByUser(nextProfile.id),
          ]);
          setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
          setTransactions(storedTransactions);
          setCategories(storedCategories);
        } catch (loadError) {
          setError(
            loadError instanceof Error ? loadError.message : "Couldn't load your report.",
          );
        } finally {
          setIsLoading(false);
        }
      })();
    });
  }, []);

  const series = useMemo(
    () => buildPositionSeries(accounts, transactions, days, new Date()),
    [accounts, transactions, days],
  );

  const windowTransactions = useMemo(() => {
    const first = series.points[0]?.date;
    const last = series.points[series.points.length - 1]?.date;
    if (!first || !last) return [];
    return transactions.filter(
      (transaction) => transaction.occurredOn >= first && transaction.occurredOn <= last,
    );
  }, [series.points, transactions]);

  const flow = useMemo(() => getFlowBreakdown(windowTransactions), [windowTransactions]);
  const windowSpending = useMemo(
    () => getSummaryForTransactions(windowTransactions, categories),
    [categories, windowTransactions],
  );
  const allocation = useMemo(() => getAllocation(accounts), [accounts]);
  const calendar = useMemo(
    () => buildDailyNetCalendar(transactions, month),
    [transactions, month],
  );
  const monthNet = calendar.reduce((sum, cell) => sum + cell.net, 0);

  const calendarSelection = useMemo(
    () => defaultCalendarDay(calendar, todayIso()),
    [calendar],
  );
  const activeDate =
    selectedDate && selectedDate.startsWith(month) ? selectedDate : calendarSelection;
  const dayTransactions = useMemo(
    () => (activeDate ? transactionsOnDay(transactions, activeDate) : []),
    [activeDate, transactions],
  );


  const windowLabel = WINDOWS.find((option) => option.days === days)?.label ?? `${days} days`;

  return (
    <div className="grid gap-5">
      <h1 className="sr-only">Report</h1>

      <FilterChips
        label="Period"
        options={WINDOWS.map((option) => ({ value: option.days, label: option.label }))}
        value={days}
        onChange={setDays}
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading your report..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding to see how your money has moved."
          href="/onboarding"
          cta="Set up your profile"
        />
      ) : null}

      {!isLoading && profile ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What you are worth</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{windowLabel} change</p>
                <div className="font-display text-[clamp(1.75rem,8vw,2.5rem)] leading-[1.1] font-semibold tracking-tight">
                  <Money amount={series.change} tone="auto" signed className="font-display" />
                </div>
                {series.changePercent.kind === "delta" ? (
                  <AmountIndicator
                    tone="neutral"
                    direction={
                      (series.changePercent.value ?? 0) === 0
                        ? "flat"
                        : (series.changePercent.value ?? 0) > 0
                          ? "up"
                          : "down"
                    }
                    showIcon
                    value={`${Math.abs(series.changePercent.value ?? 0).toFixed(0)}%`}
                    className="text-sm text-muted-foreground"
                    iconClassName="h-3.5 w-3.5"
                  />
                ) : null}
              </div>

              <PositionChart points={series.points} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">In and out</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <FlowTile
                label="Money in"
                count={flow.inflowCount}
                amount={flow.inflow}
                tone="positive"
              />
              <FlowTile
                label="Money out"
                count={flow.outflowCount}
                amount={flow.outflow}
                tone="negative"
              />
            </CardContent>
          </Card>

          <CostOfMoving accounts={accounts} transactions={windowTransactions} />

          <DashboardTopSpendingCategories
            categories={windowSpending.topCategories}
            totalOutflow={windowSpending.outflow}
          />

          {allocation.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where it sits</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                  {allocation.map((slice, index) => (
                    <div
                      key={slice.key}
                      className={index === 0 ? "bg-foreground" : "bg-muted-foreground/45"}
                      style={{ width: `${Math.max(slice.share * 100, 2)}%` }}
                    />
                  ))}
                </div>
                <ul className="grid gap-2">
                  {allocation.map((slice) => (
                    <li
                      key={slice.key}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">
                        {slice.label}
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                          {Math.round(slice.share * 100)}%
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatMoney(slice.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Day by day</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Previous month"
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                >
                  ‹
                </Button>
                <div className="grid justify-items-center gap-0.5">
                  <span className="text-sm font-medium text-foreground">{monthLabel(month)}</span>
                  <span className="text-xs text-muted-foreground">
                    Net <Money amount={monthNet} tone="auto" signed />
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Next month"
                  disabled={month >= monthKey(new Date())}
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                >
                  ›
                </Button>
              </div>

              <MoneyCalendar
                cells={calendar}
                month={month}
                selectedDate={activeDate}
                onSelectDate={setSelectedDate}
              />

              {activeDate ? (
                <DayTransactions
                  date={activeDate}
                  transactions={dayTransactions}
                  categories={categories}
                />
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function FlowTile({
  label,
  count,
  amount,
  tone,
}: {
  label: string;
  count: number;
  amount: number;
  tone: "positive" | "negative";
}) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? "time" : "times"}
      </span>
      <span className="text-lg font-semibold">
        <Money amount={amount} tone={tone} signed />
      </span>
      {count > 1 ? (
        <span className="text-xs text-muted-foreground">
          {formatMoney(Math.round(amount / count))} on average
        </span>
      ) : null}
    </div>
  );
}
