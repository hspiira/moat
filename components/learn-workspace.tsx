"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { ResourceLink, UserProfile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
    title: "How people in Uganda earn, save, and move money",
    summary:
      "Use these sources to ground the product in actual Uganda money behaviour before making product or UX assumptions.",
  },
  "regulated-investing": {
    title: "Regulated investing and long-term planning",
    summary:
      "These are the primary official sources for Treasury products, regulated funds, retirement products, and exchange-listed investing paths.",
  },
  "institution-verification": {
    title: "Institution verification",
    summary:
      "Use these links to validate institutions and avoid unregulated or unclear schemes before money leaves the user’s pocket.",
  },
};

function sortResources(resources: ResourceLink[]) {
  return [...resources].sort((left, right) => left.title.localeCompare(right.title));
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
    <div className="grid gap-6">
      <Card className="border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Issue #9
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Learn Uganda
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                This route curates the official and research-grade sources behind
                the app&apos;s Uganda-first assumptions. It is where future teammates
                should start before widening scope or changing guidance rules.
              </p>
            </div>
          </div>

          <Card className="border-border/70 bg-muted/35 shadow-none">
            <CardHeader>
              <Badge variant="outline" className="w-fit bg-background/70">
                Current library
              </Badge>
              <CardTitle>{resources.length} saved source links</CardTitle>
              <CardDescription className="leading-7">
                Official and research links are grouped by topic so the education
                surface remains tied to the documented product thesis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>User profile present: {profile ? "Yes" : "No"}</div>
              <div>Official sources: {resources.filter((resource) => resource.isOfficial).length}</div>
              <div>Topic groups: {topicEntries.length}</div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-6 py-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading learning resources...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading ? (
        <>
          {!profile ? (
            <Card className="border-border/70 bg-background/90">
              <CardContent className="grid gap-4 px-6 py-8 text-sm leading-7 text-muted-foreground">
                <div>
                  These resources are available before onboarding, but the app will
                  become more useful once there is a local profile and transaction history.
                </div>
                <div>
                  <Button asChild>
                    <Link href="/accounts">Set up the app</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6">
            {topicEntries.map(([topic, topicResources]) => {
              const copy = topicCopy[topic] ?? {
                title: topic,
                summary: "Reference material for this part of the product.",
              };

              return (
                <Card key={topic} className="border-border/70 bg-background/90">
                  <CardHeader>
                    <CardTitle>{copy.title}</CardTitle>
                    <CardDescription className="leading-7">
                      {copy.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {topicResources.map((resource) => (
                      <a
                        key={resource.id}
                        className="rounded-lg border border-border bg-muted/35 px-4 py-4 transition hover:border-primary/50 hover:bg-primary/5"
                        href={resource.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-foreground">{resource.title}</div>
                          {resource.isOfficial ? <Badge variant="outline">Official</Badge> : null}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {resource.sourceName}
                        </div>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
