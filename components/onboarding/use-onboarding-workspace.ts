"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { normalizeOpeningBalance } from "@/lib/domain/accounts";
import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { usePinLock } from "@/lib/security/pin-lock-context";
import { PIN_REQUIREMENT_MESSAGE, isValidPin } from "@/lib/security/pin-policy";
import type {
  Account,
  Goal,
  GoalType,
  IncomeType,
  RiskComfort,
  SalaryCycle,
  UserProfile,
} from "@/lib/types";

const ONBOARDING_DRAFT_KEY = "moat:onboarding-draft";

export type OnboardingStep = "profile" | "account" | "goal" | "security";
export type OnboardingMode = "choose" | "fresh" | "restore_file" | "restore_drive";

export type OnboardingFormState = {
  displayName: string;
  salaryCycle: SalaryCycle;
  primaryIncomeType: IncomeType;
  riskComfort: RiskComfort;
  investmentHorizonMonths: string;
  investmentHorizonValue: string;
  investmentHorizonUnit: "months" | "years";
};

export type AccountSetupState = {
  name: string;
  type: Account["type"];
  institutionName: string;
  openingBalance: string;
};

export type GoalSetupState = {
  enabled: boolean;
  name: string;
  goalType: GoalType;
  targetAmount: string;
  targetDate: string;
};

/** Never persisted to the draft — PINs must not touch localStorage. */
export type SecuritySetupState = {
  enabled: boolean;
  pin: string;
  confirmPin: string;
};

type DraftState = {
  profile: OnboardingFormState;
  account: AccountSetupState;
  goal: GoalSetupState;
  consentGiven: boolean;
  step: OnboardingStep;
};

const defaultForm: OnboardingFormState = {
  displayName: "",
  salaryCycle: "month_end",
  primaryIncomeType: "salary",
  riskComfort: "moderate",
  investmentHorizonMonths: "36",
  investmentHorizonValue: "3",
  investmentHorizonUnit: "years",
};

const defaultAccount: AccountSetupState = {
  name: "",
  type: "mobile_money",
  institutionName: "",
  openingBalance: "0",
};

const defaultGoal: GoalSetupState = {
  enabled: true,
  name: "Emergency savings",
  goalType: "emergency_fund",
  targetAmount: "",
  targetDate: "",
};

const defaultSecurity: SecuritySetupState = {
  enabled: true,
  pin: "",
  confirmPin: "",
};

export const steps: OnboardingStep[] = ["profile", "account", "goal", "security"];

export const stepLabels: Record<OnboardingStep, string> = {
  profile: "Profile",
  account: "First account",
  goal: "First goal",
  security: "Security",
};

function buildTimestamp() {
  return new Date().toISOString();
}

function defaultGoalDate() {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString().slice(0, 10);
}

function toInstitutionType(type: Account["type"]): Account["institutionType"] {
  if (type === "bank") return "bank";
  if (type === "mobile_money") return "mobile_money";
  if (type === "sacco") return "sacco";
  return "other";
}

function readDraft(): DraftState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

function writeDraft(draft: DraftState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}

export function convertHorizonToMonths(value: string, unit: "months" | "years") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return Number.NaN;
  }

  return unit === "years" ? numericValue * 12 : numericValue;
}

function normalizeDraftProfile(profile: OnboardingFormState | undefined): OnboardingFormState {
  if (!profile) {
    return defaultForm;
  }

  if (profile.investmentHorizonValue && profile.investmentHorizonUnit) {
    const normalizedMonths = convertHorizonToMonths(
      profile.investmentHorizonValue,
      profile.investmentHorizonUnit,
    );

    return {
      ...defaultForm,
      ...profile,
      investmentHorizonMonths: String(normalizedMonths),
    };
  }

  const legacyMonths = Number(profile.investmentHorizonMonths || defaultForm.investmentHorizonMonths);
  const isWholeYears = Number.isFinite(legacyMonths) && legacyMonths % 12 === 0;

  return {
    ...defaultForm,
    ...profile,
    investmentHorizonMonths: profile.investmentHorizonMonths || defaultForm.investmentHorizonMonths,
    investmentHorizonValue:
      isWholeYears
        ? String(legacyMonths / 12)
        : profile.investmentHorizonMonths || defaultForm.investmentHorizonValue,
    investmentHorizonUnit: isWholeYears ? "years" : "months",
  };
}

function normalizeDraftAccount(accountDraft: AccountSetupState | undefined): AccountSetupState {
  return {
    ...defaultAccount,
    ...accountDraft,
  };
}

function normalizeDraftGoal(goalDraft: GoalSetupState | undefined): GoalSetupState {
  return {
    ...defaultGoal,
    targetDate: defaultGoalDate(),
    ...goalDraft,
  };
}

function getStepError(params: {
  step: OnboardingStep;
  profile: OnboardingFormState;
  account: AccountSetupState;
  goal: GoalSetupState;
  security: SecuritySetupState;
  consentGiven: boolean;
}) {
  if (params.step === "profile") {
    if (!params.profile.displayName.trim()) {
      return "Enter your name or nickname.";
    }

    const horizon = convertHorizonToMonths(
      params.profile.investmentHorizonValue,
      params.profile.investmentHorizonUnit,
    );
    if (!Number.isFinite(horizon) || horizon < 1 || horizon > 600) {
      return "Planning horizon must be between 1 and 600 months.";
    }

    if (!params.consentGiven) {
      return "You must accept the local-first privacy consent to continue.";
    }
  }

  if (params.step === "account") {
    if (!params.account.name.trim()) {
      return "Add at least one account name to start tracking money properly.";
    }

    const openingBalance = Number(params.account.openingBalance);
    if (!Number.isFinite(openingBalance)) {
      return "Opening balance must be a valid number.";
    }
  }

  if (params.step === "goal" && params.goal.enabled) {
    if (!params.goal.name.trim()) {
      return "Give your first goal a name or skip this step for now.";
    }

    const targetAmount = Number(params.goal.targetAmount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return "Goal target amount must be greater than zero.";
    }

    if (!params.goal.targetDate) {
      return "Choose a target date for your goal.";
    }
  }

  if (params.step === "security" && params.security.enabled) {
    if (!isValidPin(params.security.pin)) {
      return PIN_REQUIREMENT_MESSAGE;
    }

    if (params.security.pin !== params.security.confirmPin) {
      return "PINs do not match.";
    }
  }

  return null;
}

export function useOnboardingWorkspace() {
  const router = useRouter();
  const { setPin } = usePinLock();
  const [form, setForm] = useState<OnboardingFormState>(defaultForm);
  const [account, setAccount] = useState<AccountSetupState>(defaultAccount);
  const [goal, setGoal] = useState<GoalSetupState>({
    ...defaultGoal,
    targetDate: defaultGoalDate(),
  });
  const [security, setSecurity] = useState<SecuritySetupState>(defaultSecurity);
  const [consentGiven, setConsentGiven] = useState(false);
  const [step, setStep] = useState<OnboardingStep>("profile");
  const [mode, setMode] = useState<OnboardingMode>("choose");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => {
      void repositories.userProfile
        .get()
        .then((profile) => {
          if (profile) {
            router.replace("/");
            return;
          }

          const draft = readDraft();
          if (!draft) return;

          setForm(normalizeDraftProfile(draft.profile));
          setAccount(normalizeDraftAccount(draft.account));
          setGoal(normalizeDraftGoal(draft.goal));
          setConsentGiven(Boolean(draft.consentGiven));
          setStep(draft.step ?? "profile");
          setMode("fresh");
        })
        .catch(() => null)
        .finally(() => setIsChecking(false));
    });
  }, [router]);

  useEffect(() => {
    if (isChecking || mode !== "fresh") return;

    writeDraft({
      profile: {
        ...form,
        investmentHorizonMonths: String(
          convertHorizonToMonths(form.investmentHorizonValue, form.investmentHorizonUnit),
        ),
      },
      account,
      goal,
      consentGiven,
      step,
    });
  }, [account, consentGiven, form, goal, isChecking, mode, step]);

  const stepIndex = steps.indexOf(step);
  const stepError = useMemo(
    () => getStepError({ step, profile: form, account, goal, security, consentGiven }),
    [account, consentGiven, form, goal, security, step],
  );

  async function handleNext() {
    setError(null);

    if (stepError) {
      setError(stepError);
      return;
    }

    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1]);
    }
  }

  function handleBack() {
    setError(null);
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1]);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Re-validate every step at the final submit, not just the last two, so a
    // blank name or missing consent can never slip through.
    const finalError = steps
      .map((s) => getStepError({ step: s, profile: form, account, goal, security, consentGiven }))
      .find(Boolean);
    if (finalError) {
      setError(finalError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Enable encryption before the first record is written so every entity
      // is stored encrypted from day one.
      if (security.enabled) {
        const pinSet = await setPin(security.pin);
        if (!pinSet) {
          throw new Error(PIN_REQUIREMENT_MESSAGE);
        }
      }

      const timestamp = buildTimestamp();
      const horizonMonths = convertHorizonToMonths(
        form.investmentHorizonValue,
        form.investmentHorizonUnit,
      );
      const profile: UserProfile = {
        id: "user:default",
        displayName: form.displayName.trim(),
        currency: "UGX",
        salaryCycle: form.salaryCycle,
        primaryIncomeType: form.primaryIncomeType,
        riskComfort: form.riskComfort,
        investmentHorizonMonths: horizonMonths,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const bootstrapState = createBootstrapState(profile);
      const accountId = `account:${crypto.randomUUID()}`;
      const openingBalance = normalizeOpeningBalance(account.type, Number(account.openingBalance));

      await Promise.all(bootstrapState.categories.map((c) => repositories.categories.upsert(c)));
      await repositories.investmentProfiles.save(bootstrapState.investmentProfile);
      await repositories.resources.replaceAll(bootstrapState.resources);
      await repositories.accounts.upsert({
        id: accountId,
        userId: profile.id,
        name: account.name.trim(),
        type: account.type,
        institutionName: account.institutionName.trim() || undefined,
        institutionType: toInstitutionType(account.type),
        openingBalance,
        balance: openingBalance,
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (goal.enabled) {
        await repositories.goals.upsert({
          id: `goal:${crypto.randomUUID()}`,
          userId: profile.id,
          name: goal.name.trim(),
          goalType: goal.goalType,
          targetAmount: Number(goal.targetAmount),
          currentAmount: 0,
          targetDate: goal.targetDate,
          priority: 1,
          linkedAccountId: accountId,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as Goal);
      }

      // Saved last: the profile's presence is what marks onboarding complete,
      // so it must only exist once every bootstrap write above has succeeded.
      await repositories.userProfile.save(profile);

      announceLocalSave({
        entity: "onboarding",
        savedAt: timestamp,
        message: "Profile setup saved locally",
      });
      clearDraft();
      router.push("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create profile.",
      );
      setIsSubmitting(false);
    }
  }

  function handleRestored() {
    clearDraft();
    router.replace("/");
  }

  return {
    form,
    setForm,
    account,
    setAccount,
    goal,
    setGoal,
    security,
    setSecurity,
    consentGiven,
    setConsentGiven,
    step,
    stepIndex,
    mode,
    setMode,
    isSubmitting,
    isChecking,
    error,
    handleNext,
    handleBack,
    handleSubmit,
    handleRestored,
  };
}
