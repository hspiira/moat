"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { FeaturePageShell } from "@/components/feature-page-shell";
import { EmptyStateCard } from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputField } from "@/components/forms/input-field";
import { FormCardShell } from "@/components/forms/form-card-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Money } from "@/components/ui/money";
import { useToast } from "@/components/ui/toast";
import { getProjectSummary, type ProjectSummary } from "@/lib/domain/projects";
import { createId } from "@/lib/ids";
import { repositories } from "@/lib/repositories/instance";
import { todayIso } from "@/lib/today";
import { errorMessage } from "@/lib/errors";
import { validateInteger } from "@/lib/validation";
import type { Category, Project, Transaction, UserProfile } from "@/lib/types";

export function ProjectsWorkspace() {
  const { show } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);
      if (!nextProfile) return;

      const [storedProjects, storedTransactions, storedCategories] = await Promise.all([
        repositories.projects.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
        repositories.categories.listByUser(nextProfile.id),
      ]);

      setProjects(storedProjects);
      setTransactions(storedTransactions);
      setCategories(storedCategories);
    } catch (loadError) {
      setError(errorMessage(loadError, "Couldn't load projects."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, []);

  const summaries: ProjectSummary[] = useMemo(
    () =>
      projects
        .filter((project) => !project.isArchived)
        .map((project) => getProjectSummary(project, transactions, categories))
        .sort((left, right) => right.spent - left.spent),
    [categories, projects, transactions],
  );

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the project a name.");
      return;
    }

    const budgetError = budget.trim()
      ? validateInteger(budget, 1, Number.MAX_SAFE_INTEGER, "Enter a whole number of shillings.")
      : null;
    if (budgetError) {
      setError(budgetError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const timestamp = new Date().toISOString();
      await repositories.projects.upsert({
        id: createId(),
        userId: profile.id,
        name: trimmed,
        startedOn: todayIso(),
        budgetAmount: budget.trim() ? Number(budget) : undefined,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      setName("");
      setBudget("");
      setIsFormOpen(false);
      show("Project added.", "success");
      await load();
    } catch (submitError) {
      setError(errorMessage(submitError, "Couldn't save the project."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnd(project: Project) {
    setIsSubmitting(true);
    try {
      await repositories.projects.upsert({
        ...project,
        endedOn: todayIso(),
        updatedAt: new Date().toISOString(),
      });
      show(`${project.name} closed.`, "success");
      await load();
    } catch (submitError) {
      setError(errorMessage(submitError, "Couldn't close the project."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FeaturePageShell
      title="Projects"
      description="A one-off that spans categories and months, a relocation, a wedding, a term of school fees. Tag its spending and see what it really cost."
      profile={profile}
      isLoading={isLoading}
      error={error}
      setupMessage="Set up your profile before tracking a project."
    >
      <Button
        type="button"
        className="justify-self-start"
        onClick={() => {
          setError(null);
          setIsFormOpen(true);
        }}
      >
        Start a project
      </Button>

      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Start a project</SheetTitle>
            <SheetDescription>Name a one-off and give it a budget.</SheetDescription>
          </SheetHeader>
          <FormCardShell
            embedded
            title="Start a project"
            description="Once it exists you can tag spending to it from the transaction form, including money you have already recorded."
            footer={
              <Button
                type="submit"
                size="lg"
                form="project-form"
                disabled={isSubmitting || !name.trim()}
                className="w-full"
              >
                {isSubmitting ? "Saving..." : "Start project"}
              </Button>
            }
          >
            <form
              id="project-form"
              className="grid gap-4"
              onSubmit={(event) => void handleCreate(event)}
            >
              <InputField
                id="project-name"
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Relocation"
              />
              <InputField
                id="project-budget"
                label="Budget (optional)"
                inputMode="numeric"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="4000000"
                hint="What you expect the whole thing to cost."
              />
            </form>
          </FormCardShell>
        </SheetContent>
      </Sheet>

      {summaries.length === 0 ? (
        <EmptyStateCard
          title="No projects yet"
          message="Start one, then tag the spending that belongs to it."
        />
      ) : (
        summaries.map((summary) => (
          <Card key={summary.project.id} className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{summary.project.name}</CardTitle>
              <CardDescription>
                {summary.count === 0
                  ? "Nothing tagged to it yet."
                  : `${summary.count} ${summary.count === 1 ? "entry" : "entries"} across ${summary.byCategory.length} ${summary.byCategory.length === 1 ? "category" : "categories"} and ${summary.monthsSpanned} ${summary.monthsSpanned === 1 ? "month" : "months"}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Money amount={summary.spent} tone="neutral" className="text-xl font-semibold" />
                {summary.budgetRemaining === null ? null : (
                  <span className="text-sm text-muted-foreground">
                    {summary.isOverBudget ? "over budget by " : "left of budget: "}
                    <Money
                      amount={Math.abs(summary.budgetRemaining)}
                      tone={summary.isOverBudget ? "negative" : "positive"}
                      symbol="short"
                    />
                  </span>
                )}
              </div>

              {summary.byCategory.length > 0 ? (
                <ul className="grid gap-2">
                  {summary.byCategory.map((entry) => (
                    <li key={entry.categoryId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {entry.categoryName}
                      </span>
                      <Money amount={entry.amount} symbol="short" className="text-sm" />
                    </li>
                  ))}
                </ul>
              ) : null}

              {summary.project.endedOn ? (
                <p className="text-xs text-muted-foreground">Closed {summary.project.endedOn}.</p>
              ) : (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() => void handleEnd(summary.project)}
                  >
                    Close project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </FeaturePageShell>
  );
}
