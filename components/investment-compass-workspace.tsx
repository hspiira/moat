"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { getInvestmentGuidance } from "@/lib/domain/guidance";
import { announceLocalSave } from "@/lib/local-save";
import { getMonthSummary } from "@/lib/domain/summaries";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Goal,
  InvestmentProfile,
  LiquidityNeed,
  ResourceLink,
  RiskComfort,
  Transaction,
  UserProfile,
} from "@/lib/types";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const goalFocusOptions: { value: InvestmentProfile["goalFocus"]; label: string }[] = [
  { value: "general_wealth", label: "General wealth" },
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "rent_buffer", label: "Rent buffer" },
  { value: "school_fees", label: "School fees" },
  { value: "land_savings", label: "Land savings" },
  { value: "business_capital", label: "Business capital" },
  { value: "education", label: "Education" },
  { value: "house_construction", label: "House / Construction" },
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

function getEmergencyFundMonthsCovered(
  goals: Goal[],
  transactions: Transaction[],
  month: string,
) {
  const emergencyGoal = goals.find((g) => g.goalType === "emergency_fund") ?? null;
  const monthSummary = getMonthSummary(transactions, [], month);
  if (!emergencyGoal || monthSummary.outflow <= 0) return 0;
  return emergencyGoal.currentAmount / monthSummary.outflow;
}

function hasHighCostDebt(transactions: Transaction[]) {
  return transactions.some((t) => t.type === "debt_payment");
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        loadError instanceof Error ? loadError.message : "Unable to load Investment Compass.",
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
      investmentProfile ?? (profile ? createBootstrapState(profile).investmentProfile : null);
    if (!activeProfile) return null;
    return getInvestmentGuidance({
      profile: activeProfile,
      emergencyFundMonthsCovered,
      hasHighCostDebt: hasHighCostDebt(transactions),
    });
  }, [emergencyFundMonthsCovered, investmentProfile, profile, transactions]);

  const regulatedResources = resources.filter(
    (r) => r.topic === "regulated-investing" || r.topic === "institution-verification",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

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
      const message = "Investment profile saved locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "investment_profile", savedAt: timestamp, message });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save investment profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Investment Compass</h1>
        <p className="text-sm text-muted-foreground">
          Rule-based guidance for Uganda. No stock picks, no guaranteed returns.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading guidance...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="grid gap-4 px-5 py-8 text-sm text-muted-foreground">
            <p>
              Complete onboarding so the compass can read your time horizon, goals, and
              transaction history.
            </p>
            <Button asChild size="sm">
              <Link href="/onboarding">Set up your profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile && investmentProfile && guidance ? (
        <>
          {monthlyOutflow > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/40 shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Monthly outflow baseline</CardDescription>
                  <CardTitle className="text-xl tabular-nums">
                    {formatCurrency(monthlyOutflow)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/40 shadow-none">
                <CardHeader className="pb-2">
                  <CardDescription>Emergency coverage</CardDescription>
                  <CardTitle className="text-xl">
                    {emergencyFundMonthsCovered.toFixed(1)} month
                    {emergencyFundMonthsCovered !== 1 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Your investment profile</CardTitle>
                <CardDescription>
                  Update these settings to see how guidance changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  <LocalSaveFeedback
                    isSubmitting={isSubmitting}
                    lastSavedAt={lastSavedAt}
                    successMessage={successMessage}
                  />

                  <div className="grid gap-2">
                    <Label htmlFor="time-horizon">Time horizon (months)</Label>
                    <Input
                      id="time-horizon"
                      inputMode="numeric"
                      min="1"
                      value={form.timeHorizonMonths}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, timeHorizonMonths: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="liquidity-need">Liquidity need</Label>
                    <Select
                      value={form.liquidityNeed}
                      onValueChange={(v) =>
                        setForm((c) => ({ ...c, liquidityNeed: v as LiquidityNeed }))
                      }
                    >
                      <SelectTrigger id="liquidity-need">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="near_term">Near term</SelectItem>
                        <SelectItem value="long_term">Long term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="risk-comfort">Risk comfort</Label>
                    <Select
                      value={form.riskComfort}
                      onValueChange={(v) =>
                        setForm((c) => ({ ...c, riskComfort: v as RiskComfort }))
                      }
                    >
                      <SelectTrigger id="risk-comfort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="goal-focus">Goal focus</Label>
                    <Select
                      value={form.goalFocus}
                      onValueChange={(v) =>
                        setForm((c) => ({
                          ...c,
                          goalFocus: v as InvestmentProfile["goalFocus"],
                        }))
                      }
                    >
                      <SelectTrigger id="goal-focus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {goalFocusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guidance-level">Guidance detail</Label>
                    <Select
                      value={form.guidanceLevel}
                      onValueChange={(v) =>
                        setForm((c) => ({
                          ...c,
                          guidanceLevel: v as InvestmentProfile["guidanceLevel"],
                        }))
                      }
                    >
                      <SelectTrigger id="guidance-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button disabled={isSubmitting} type="submit" size="sm">
                    {isSubmitting ? "Saving..." : "Update profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4 content-start">
              <Card className="border-border/40 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Suggested product classes</CardTitle>
                  <CardDescription>
                    These are regulated or capital-preserving categories — not specific
                    product recommendations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {guidance.recommendedProducts.map((product) => (
                    <div
                      key={product}
                      className="rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-sm text-foreground"
                    >
                      {product}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Why this guidance</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm leading-6 text-muted-foreground">
                  {guidance.rationale.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {guidance.warnings.length > 0 ? (
                    <div className="mt-1 grid gap-2 rounded-md border border-amber-300/40 bg-amber-50/60 px-4 py-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      {guidance.warnings.map((warning) => (
                        <p key={warning} className="text-sm">
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {regulatedResources.length > 0 ? (
                <Card className="border-border/40 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Regulated Uganda sources</CardTitle>
                    <CardDescription>
                      Verify institutions through official channels before committing funds.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {regulatedResources.map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url}
                        rel="noreferrer"
                        target="_blank"
                        className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-border/70 hover:bg-muted/50"
                      >
                        <div>
                          <div className="font-medium text-foreground">{resource.title}</div>
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
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
