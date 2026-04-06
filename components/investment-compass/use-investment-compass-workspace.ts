"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { getInvestmentGuidance } from "@/lib/domain/guidance";
import { announceLocalSave } from "@/lib/local-save";
import { getMonthSummary } from "@/lib/domain/summaries";
import { repositories } from "@/lib/repositories/instance";
import type {
  Goal,
  InvestmentProfile,
  LiquidityNeed,
  ResourceLink,
  RiskComfort,
  Transaction,
  UserProfile,
} from "@/lib/types";


export type InvestmentProfileFormState = {
  timeHorizonMonths: string;
  liquidityNeed: LiquidityNeed;
  riskComfort: RiskComfort;
  goalFocus: InvestmentProfile["goalFocus"];
  guidanceLevel: InvestmentProfile["guidanceLevel"];
};

export const defaultInvestmentProfileForm: InvestmentProfileFormState = {
  timeHorizonMonths: "36",
  liquidityNeed: "near_term",
  riskComfort: "moderate",
  goalFocus: "general_wealth",
  guidanceLevel: "starter",
};

function buildTimestamp() {
  return new Date().toISOString();
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
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

function getEmergencyFundMonthsCovered(
  goals: Goal[],
  transactions: Transaction[],
  month: string,
) {
  const emergencyGoal = goals.find((goal) => goal.goalType === "emergency_fund") ?? null;
  const monthSummary = getMonthSummary(transactions, [], month);
  if (!emergencyGoal || monthSummary.outflow <= 0) return 0;
  return emergencyGoal.currentAmount / monthSummary.outflow;
}

function hasHighCostDebt(transactions: Transaction[]) {
  return transactions.some((transaction) => transaction.type === "debt_payment");
}

export function useInvestmentCompassWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [investmentProfile, setInvestmentProfile] = useState<InvestmentProfile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [resources, setResources] = useState<ResourceLink[]>([]);
  const [form, setForm] = useState<InvestmentProfileFormState>(defaultInvestmentProfileForm);
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

  const regulatedResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          resource.topic === "regulated-investing" ||
          resource.topic === "institution-verification",
      ),
    [resources],
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

  return {
    profile,
    investmentProfile,
    form,
    goals,
    monthlyOutflow,
    emergencyFundMonthsCovered,
    guidance,
    regulatedResources,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    setForm,
    handleSubmit,
  };
}
