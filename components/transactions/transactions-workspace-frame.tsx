"use client";

import type { ComponentProps, ReactNode } from "react";

import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import type { UserProfile } from "@/lib/types";

import { TransactionsSummaryStrip } from "./transactions-summary-strip";

type Props = {
  title: string;
  description?: string;
  srOnlyTitle?: boolean;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  summary?: ComponentProps<typeof TransactionsSummaryStrip>;
  children: ReactNode;
};

export function TransactionsWorkspaceFrame({
  title,
  description,
  srOnlyTitle,
  profile,
  isLoading,
  error,
  summary,
  children,
}: Props) {
  return (
    <div className="grid gap-5">
      <PageHeader title={title} description={description} srOnlyTitle={srOnlyTitle} />

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
          {summary ? <TransactionsSummaryStrip {...summary} /> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
