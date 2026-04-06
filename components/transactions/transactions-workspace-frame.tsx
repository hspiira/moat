"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-shell/page-header";
import { MetricChip } from "@/components/page-shell/metric-chip";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import type { MonthSummary, UserProfile } from "@/lib/types";

import { TransactionsRouteLinks } from "./transactions-route-links";
import { TransactionsSummaryStrip } from "./transactions-summary-strip";

type TransactionsRoute = "ledger" | "capture" | "import" | "review" | "tools";

type Props = {
  currentRoute: TransactionsRoute;
  title: string;
  description: string;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  transactionCount: number;
  periodTransactionCount: number;
  reviewCount: number;
  duplicateCount: number;
  periodSummary: MonthSummary;
  children: ReactNode;
};

export function TransactionsWorkspaceFrame({
  currentRoute,
  title,
  description,
  profile,
  isLoading,
  error,
  transactionCount,
  periodTransactionCount,
  reviewCount,
  duplicateCount,
  periodSummary,
  children,
}: Props) {
  return (
    <div className="grid gap-5">
      <PageHeader
        title={title}
        description={description}
        aside={
          transactionCount > 0 ? (
            <MetricChip
              value={
                <span className="text-2xl font-semibold tracking-tight">
                  {transactionCount}
                </span>
              }
              label="Recorded"
              className="moat-panel-yellow border-border/20"
            />
          ) : null
        }
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading transactions..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding and add at least one account before recording transactions."
          href="/onboarding"
          cta="Get started"
        />
      ) : null}

      {!isLoading && profile ? (
        <div className="grid gap-5">
          <TransactionsSummaryStrip
            transactionCount={periodTransactionCount}
            reviewCount={reviewCount}
            duplicateCount={duplicateCount}
            summary={periodSummary}
          />
          <TransactionsRouteLinks current={currentRoute} />
          {children}
        </div>
      ) : null}
    </div>
  );
}
