"use client";
import { startTransition, useEffect, useMemo, useState } from "react";
import { IconExternalLink, IconRosetteDiscountCheck } from "@tabler/icons-react";

import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { repositories } from "@/lib/repositories/instance";
import type { ResourceLink, UserProfile } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


const topicCopy: Record<string, { title: string; summary: string }> = {
  "money-behaviour": {
    title: "How money works in Uganda",
    summary:
      "Research and data on how Ugandans earn, save, and move money. Use these before making product or financial decisions.",
  },
  "regulated-investing": {
    title: "Regulated investing and long-term products",
    summary:
      "Official sources for Treasury products, regulated funds, retirement options, and exchange-listed paths available in Uganda.",
  },
  "institution-verification": {
    title: "How to verify financial institutions",
    summary:
      "Check any SACCO, fund manager, or scheme through these official sources before moving money.",
  },
};

function sortResources(resources: ResourceLink[]) {
  return [...resources].sort((a, b) => a.title.localeCompare(b.title));
}

export function LearnWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const [nextProfile, nextResources] = await Promise.all([
        repositories.userProfile.get(),
        repositories.resources.list(),
      ]);

      setProfile(nextProfile);
      setResources(sortResources(nextResources));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load learning resources.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  const resourcesByTopic = useMemo(() => {
    return resources.reduce<Record<string, ResourceLink[]>>((groups, resource) => {
      groups[resource.topic] = [...(groups[resource.topic] ?? []), resource];
      return groups;
    }, {});
  }, [resources]);

  const topicEntries = Object.entries(resourcesByTopic);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Learn Uganda"
        description="Official and research-grade sources behind this app&apos;s Uganda-first assumptions."
        aside={
          <MetricChip
            value={<span className="text-2xl font-semibold tracking-tight">{resources.length}</span>}
            label="Sources"
          />
        }
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading resources..." /> : null}

      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="These resources are available to everyone. Set up your profile to unlock personalised guidance and tracking."
          href="/onboarding"
          cta="Get started"
        />
      ) : null}

      {!isLoading ? (
        <div className="grid gap-5">
          <Card className="ring-1 ring-primary/15">
            <CardContent className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:gap-6">
              {[
                { kicker: "Official first", value: "Verify before you move money" },
                { kicker: "Product research", value: "Use data, not promises" },
                { kicker: "Guidance boundary", value: "Education, not hot picks" },
              ].map((principle) => (
                <div key={principle.kicker} className="space-y-1">
                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {principle.kicker}
                  </p>
                  <p className="font-display text-base leading-snug font-medium">
                    {principle.value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {topicEntries.map(([topic, topicResources]) => {
            const copy = topicCopy[topic] ?? {
              title: topic,
              summary: "Reference material.",
            };
            return (
              <Card key={topic}>
                <CardHeader className="border-b border-border/60 pb-4 [.border-b]:pb-4">
                  <CardTitle className="font-display text-lg">{copy.title}</CardTitle>
                  <CardDescription className="max-w-3xl leading-6">{copy.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2">
                  {topicResources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      rel="noreferrer"
                      target="_blank"
                      className="group flex items-start justify-between gap-3 rounded-md border border-border/60 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <span className="truncate">{resource.title}</span>
                          <IconExternalLink
                            aria-hidden
                            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {resource.sourceName}
                        </div>
                      </div>
                      {resource.isOfficial ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-sm bg-pos/10 px-2 py-0.5 text-xs font-medium text-pos">
                          <IconRosetteDiscountCheck aria-hidden className="size-3.5" />
                          Official
                        </span>
                      ) : null}
                    </a>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
