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
  srOnlyTitle?: boolean;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string;
  setupMessage: string;
  children: ReactNode;
};

export function FeaturePageShell({
  title,
  description,
  srOnlyTitle,
  profile,
  isLoading,
  error,
  loadingMessage,
  setupMessage,
  children,
}: Props) {
  return (
    <div className="grid gap-5">
      <PageHeader title={title} description={description} srOnlyTitle={srOnlyTitle} />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message={loadingMessage} /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard message={setupMessage} href="/onboarding" cta="Get started" />
      ) : null}

      {!isLoading && profile ? children : null}
    </div>
  );
}
