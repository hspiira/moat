"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { getInvestmentGuidance } from "@/lib/domain/guidance";
import { getMonthSummary } from "@/lib/domain/summaries";
import type {
  Goal,
  InvestmentProfile,
  LiquidityNeed,
  ResourceLink,
  RiskComfort,
  Transaction,
  UserProfile,
} from "@/lib/types";
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

type InvestmentProfileFormState = {
  timeHorizonMonths: string;
  liquidityNeed: LiquidityNeed;
  riskComfort: RiskComfort;
  goalFocus: InvestmentProfile["goalFocus"];
  guidanceLevel: InvestmentProfile["guidanceLevel"];
};

const defaultForm: InvestmentProfileFormState = {
  timeHorizonMonths: "36",
  liquidityNeed: "near_term",
  riskComfort: "moderate",
  goalFocus: "general_wealth",
  guidanceLevel: "starter",
};

const goalFocusOptions: InvestmentProfile["goalFocus"][] = [
  "general_wealth",
  "emergency_fund",
  "rent_buffer",
  "school_fees",
  "land_savings",
  "business_capital",
  "education",
  "house_construction",
];

function buildTimestamp() {
  return new Date().toISOString();
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function labelGoalFocus(goalFocus: InvestmentProfile["goalFocus"]) {
  if (goalFocus === "general_wealth") {
    return "General wealth";
  }

  return goalFocus.replaceAll("_", " ");
}

function getEmergencyFundMonthsCovered(
  goals: Goal[],
  transactions: Transaction[],
  month: string,
) {
  const emergencyGoal =
    goals.find((goal) => goal.goalType === "emergency_fund") ?? null;
  const monthSummary = getMonthSummary(transactions, [], month);

  if (!emergencyGoal || monthSummary.outflow <= 0) {
    return 0;
  }

  return emergencyGoal.currentAmount / monthSummary.outflow;
}

function hasHighCostDebt(transactions: Transaction[]) {
  return transactions.some((transaction) => transaction.type === "debt_payment");
}

function buildProfileForm(profile: InvestmentProfile): InvestmentProfileFormState {
  return {
    timeHorizonMonths: String(profile.timeHorizonMonths),
    liquidityNeed: profile.liquidityNeed,
    riskComfort: profile.riskComfort,
    goalFocus: profile.goalFocus,
    guidanceLevel: profile.guidanceLevel,
  };
}

export function InvestmentCompassWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investmentProfile, setInvestmentProfile] = useState<InvestmentProfile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [form, setForm] = useState<InvestmentProfileFormState>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      const nextResources = await repositories.resources.list();
      setResources(nextResources);
      setProfile(nextProfile);

      if (!nextProfile) {
        setInvestmentProfile(null);
        setGoals([]);
        setTransactions([]);
        return;
      }

      const [storedInvestmentProfile, storedGoals, storedTransactions] = await Promise.all([
        repositories.investmentProfiles.getByUser(nextProfile.id),
        repositories.goals.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
      ]);

      const fallbackProfile = createBootstrapState(nextProfile).investmentProfile;
      const activeProfile = storedInvestmentProfile ?? fallbackProfile;

      setInvestmentProfile(activeProfile);
      setForm(buildProfileForm(activeProfile));
      setGoals(storedGoals);
      setTransactions(storedTransactions);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load investment compass.",
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

  const currentMonth = getCurrentMonth();
  const monthlyOutflow = useMemo(
    () => getMonthSummary(transactions, [], currentMonth).outflow,
    [currentMonth, transactions],
  );
  const emergencyFundMonthsCovered = useMemo(
    () => getEmergencyFundMonthsCovered(goals, transactions, currentMonth),
    [currentMonth, goals, transactions],
  );

  const guidance = useMemo(() => {
    const activeProfile =
      investmentProfile ??
      (profile ? createBootstrapState(profile).investmentProfile : null);

    if (!activeProfile) {
      return null;
    }

    return getInvestmentGuidance({
      profile: activeProfile,
      emergencyFundMonthsCovered,
      hasHighCostDebt: hasHighCostDebt(transactions),
    });
  }, [emergencyFundMonthsCovered, investmentProfile, profile, transactions]);

  const regulatedResources = resources.filter(
    (resource) =>
      resource.topic === "regulated-investing" ||
      resource.topic === "institution-verification",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = buildTimestamp();
      const nextProfile: InvestmentProfile = {
        id: investmentProfile?.id ?? `investment-profile:${profile.id}`,
        userId: profile.id,
        timeHorizonMonths: Number(form.timeHorizonMonths),
        liquidityNeed: form.liquidityNeed,
        riskComfort: form.riskComfort,
        goalFocus: form.goalFocus,
        guidanceLevel: form.guidanceLevel,
        createdAt: investmentProfile?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      await repositories.investmentProfiles.save(nextProfile);
      setInvestmentProfile(nextProfile);
      setForm(buildProfileForm(nextProfile));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save investment profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasSetup = Boolean(profile);

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
                Investment Compass
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                This route converts saved profile, goal, and transaction data into
                rule-based investing guidance for Uganda. It does not give stock
                picks or guaranteed-return advice.
              </p>
            </div>
          </div>

          <Card className="border-border/70 bg-muted/35 shadow-none">
            <CardHeader>
              <Badge variant="outline" className="w-fit bg-background/70">
                Current signals
              </Badge>
              <CardTitle>
                {formatCurrency(monthlyOutflow)} monthly outflow baseline
              </CardTitle>
              <CardDescription className="leading-7">
                Emergency coverage currently sits at{" "}
                {emergencyFundMonthsCovered.toFixed(1)} month(s). Guidance is
                adjusted from these saved numbers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>Tracked goals: {goals.length}</div>
              <div>Debt repayment records found: {hasHighCostDebt(transactions) ? "Yes" : "No"}</div>
              <div>Regulated source links: {regulatedResources.length}</div>
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

      {!hasSetup && !isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="grid gap-4 px-6 py-8 text-sm leading-7 text-muted-foreground">
            <div>
              Complete onboarding first so the compass can read your time horizon,
              goals, and transaction history.
            </div>
            <div>
              <Button asChild>
                <Link href="/accounts">Set up profile and accounts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading investment compass...
          </CardContent>
        </Card>
      ) : null}

      {hasSetup && !isLoading && investmentProfile && guidance ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle>Investment profile</CardTitle>
              <CardDescription className="leading-7">
                Persist the user&apos;s planning stance here. The guidance engine
                reads this profile together with goals and transaction history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Time horizon in months</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    inputMode="numeric"
                    min="1"
                    value={form.timeHorizonMonths}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        timeHorizonMonths: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Liquidity need</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={form.liquidityNeed}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        liquidityNeed: event.target.value as LiquidityNeed,
                      }))
                    }
                  >
                    <option value="immediate">Immediate</option>
                    <option value="near_term">Near term</option>
                    <option value="long_term">Long term</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Risk comfort</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={form.riskComfort}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        riskComfort: event.target.value as RiskComfort,
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Goal focus</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={form.goalFocus}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        goalFocus: event.target.value as InvestmentProfile["goalFocus"],
                      }))
                    }
                  >
                    {goalFocusOptions.map((goalFocus) => (
                      <option key={goalFocus} value={goalFocus}>
                        {labelGoalFocus(goalFocus)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Guidance detail</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={form.guidanceLevel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        guidanceLevel: event.target.value as InvestmentProfile["guidanceLevel"],
                      }))
                    }
                  >
                    <option value="starter">Starter</option>
                    <option value="standard">Standard</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>

                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : "Save investment profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Recommended product classes</CardTitle>
                <CardDescription className="leading-7">
                  These are categories of regulated or capital-preserving options,
                  not personalized security recommendations.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {guidance.recommendedProducts.map((product) => (
                  <Card key={product} className="border-border/70 bg-muted/35 shadow-none">
                    <CardContent className="px-4 py-4 text-sm text-foreground">
                      {product}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Why the engine is saying this</CardTitle>
                <CardDescription className="leading-7">
                  The guidance is driven by the stored time horizon, liquidity need,
                  emergency coverage, and debt signals.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground">
                {guidance.rationale.map((item) => (
                  <div key={item}>{item}</div>
                ))}
                {guidance.warnings.length > 0 ? (
                  <div className="grid gap-3 rounded-lg border border-amber-300/40 bg-amber-100/20 px-4 py-4 text-amber-950 dark:text-amber-100">
                    {guidance.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Regulated Uganda sources</CardTitle>
                <CardDescription className="leading-7">
                  Verify institutions before committing funds. Use official sources
                  before any scheme, SACCO, or fund manager claim.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {regulatedResources.map((resource) => (
                  <a
                    key={resource.id}
                    className="rounded-lg border border-border bg-muted/35 px-4 py-4 text-sm transition hover:border-primary/50 hover:bg-primary/5"
                    href={resource.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{resource.title}</div>
                      {resource.isOfficial ? <Badge variant="outline">Official</Badge> : null}
                    </div>
                    <div className="mt-1 text-muted-foreground">{resource.sourceName}</div>
                  </a>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
