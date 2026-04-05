"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { ResourceLink, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const repositories = createIndexedDbRepositories();

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Learn Uganda</h1>
          <p className="text-sm text-muted-foreground">
            Official and research-grade sources behind this app's Uganda-first assumptions.
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{resources.length}</div>
          <div className="text-xs">sources</div>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading resources...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="grid gap-4 px-5 py-6 text-sm text-muted-foreground">
            <p>
              These resources are available to everyone. Set up your profile to unlock
              personalised guidance and tracking.
            </p>
            <Button asChild size="sm">
              <Link href="/onboarding">Get started</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <div className="grid gap-5">
          {topicEntries.map(([topic, topicResources]) => {
            const copy = topicCopy[topic] ?? {
              title: topic,
              summary: "Reference material.",
            };

            return (
              <Card key={topic} className="border-border/40 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{copy.title}</CardTitle>
                  <CardDescription>{copy.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-2">
                  {topicResources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.url}
                      rel="noreferrer"
                      target="_blank"
                      className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:border-border/70 hover:bg-muted/50"
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
