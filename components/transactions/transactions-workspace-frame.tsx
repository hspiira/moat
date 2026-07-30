"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import type { MonthSummary, UserProfile } from "@/lib/types";

import { TransactionsSummaryStrip } from "./transactions-summary-strip";

type TransactionsRoute = "ledger" | "capture" | "import" | "review" | "tools";

type Props = {
  currentRoute: TransactionsRoute;
  title: string;
  description?: string;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  transactionCount: number;
  periodTransactionCount: number;
  reviewCount: number;
  captureInboxCount: number;
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
  captureInboxCount,
  duplicateCount,
  periodSummary,
  children,
}: Props) {
  return (
    <div className="grid gap-5">
      <PageHeader title={title} description={description} />

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
          {currentRoute === "ledger" ? (
            <TransactionsSummaryStrip
              recordedCount={transactionCount}
              transactionCount={periodTransactionCount}
              reviewCount={reviewCount}
              captureInboxCount={captureInboxCount}
              duplicateCount={duplicateCount}
              summary={periodSummary}
            />
          ) : null}
          {/* The route tab row that used to sit here was a second navigation
              system competing with the bottom bar, and it framed capture,
              review, import and tools as things that live *inside*
              Transactions rather than as their own destinations. They are
              reachable from the bottom nav's capture button and the More
              sheet; this page now shows the ledger, not a directory. */}
          {children}
        </div>
      ) : null}
    </div>
  );
}
