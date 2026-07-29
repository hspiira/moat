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
  loadingMessage?: string;
  setupMessage: string;
  children: ReactNode;
};

/**
 * Shell for a feature that owns its own route.
 *
 * Deliberately thinner than TransactionsWorkspaceFrame: no summary strip and
 * no sibling tab row. Budgets, debt payoff and recurring bills used to be
 * panels bolted onto other pages, which is what made Transactions read as a
 * catch-all. A destination should show its own thing and let the bottom bar
 * handle navigation.
 */
export function FeaturePageShell({
  title,
  description,
  profile,
  isLoading,
  error,
  loadingMessage,
  setupMessage,
  children,
}: Props) {
  return (
    <div className="grid gap-5">
      <PageHeader title={title} description={description} />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message={loadingMessage} /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard message={setupMessage} href="/onboarding" cta="Get started" />
      ) : null}

      {!isLoading && profile ? children : null}
    </div>
  );
}
