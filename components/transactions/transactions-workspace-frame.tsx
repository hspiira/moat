"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import type { UserProfile } from "@/lib/types";

type Props = {
  title: string;
  description?: string;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  children: ReactNode;
};

export function TransactionsWorkspaceFrame({
  title,
  description,
  profile,
  isLoading,
  error,
  children,
}: Props) {
  return (
    <div className="grid gap-4">
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
        <div className="grid gap-4">{children}</div>
      ) : null}
    </div>
  );
}
