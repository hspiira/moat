"use client";
import { startTransition, useEffect, useMemo, useState } from "react";

import { AccentCardHeader, type AccentTone } from "@/components/accent-card-header";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { repositories } from "@/lib/repositories/instance";
import type { ResourceLink, UserProfile } from "@/lib/types";
import { AccentMetricCard } from "@/components/ui/accent-metric-card";
import {
  Card,
  CardContent,
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
  const topicTones: AccentTone[] = ["yellow", "lilac", "mint"];

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Learn Uganda"
        description="Official and research-grade sources behind this app&apos;s Uganda-first assumptions."
        aside={
          <MetricChip
            value={<span className="text-2xl font-semibold tracking-tight">{resources.length}</span>}
            label="Sources"
            className="moat-panel-yellow border-border/20"
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
          <div className="grid gap-3 lg:grid-cols-3">
            <AccentMetricCard
              tone="yellow"
              kicker="Official first"
              value="Verify before you move money"
            />
            <AccentMetricCard
              tone="lilac"
              kicker="Product research"
              value="Use data, not promises"
            />
            <AccentMetricCard
              tone="mint"
              kicker="Guidance boundary"
              value="Education, not hot picks"
            />
          </div>

          {topicEntries.map(([topic, topicResources], index) => {
            const copy = topicCopy[topic] ?? {
              title: topic,
              summary: "Reference material.",
            };
            const tone = topicTones[index % topicTones.length];

            return (
              <Card key={topic} className="gap-0 pt-0 border-border/20 shadow-none">
                <AccentCardHeader
                  tone={tone}
                  title={copy.title}
                  description={copy.summary}
                  descriptionClassName="max-w-3xl"
                />
                <CardContent className="grid gap-2 p-5 md:grid-cols-2">
                  {topicResources.map((resource, resourceIndex) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      rel="noreferrer"
                      target="_blank"
                      className={`flex items-start justify-between gap-3 border px-4 py-3 transition-colors hover:border-foreground/30 ${
                        resourceIndex === 0
                          ? "moat-panel-sage border-border/20"
                          : resourceIndex % 2 === 0
                            ? "moat-panel-mint border-border/20"
                            : "bg-muted/20 border-border/20"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {resource.title}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {resource.sourceName}
                        </div>
                      </div>
                      {resource.isOfficial ? (
                        <span className="shrink-0 rounded border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
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
