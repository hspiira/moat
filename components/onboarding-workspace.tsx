"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { defaultAccountTypes, defaultGoalTypes } from "@/lib/app-state/defaults";
import { normalizeOpeningBalance } from "@/lib/domain/accounts";
import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import type {
  Account,
  Goal,
  GoalType,
  IncomeType,
  RiskComfort,
  SalaryCycle,
  UserProfile,
} from "@/lib/types";
import { goalTypeLabels } from "@/components/goals/goal-form";
import { InputField } from "@/components/forms/input-field";
import { OnboardingRecoveryPanel } from "@/components/onboarding-recovery-panel";
import { SelectField } from "@/components/forms/select-field";
import { optionsFromRecord } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ONBOARDING_DRAFT_KEY = "moat:onboarding-draft";
const HORIZON_PRESETS = [
  { value: "12", unit: "months" as const, label: "12 months" },
  { value: "2", unit: "years" as const, label: "2 years" },
  { value: "3", unit: "years" as const, label: "3 years" },
  { value: "5", unit: "years" as const, label: "5 years" },
];

type OnboardingStep = "profile" | "account" | "goal";
type OnboardingMode = "choose" | "fresh" | "restore_file" | "restore_drive";

type OnboardingFormState = {
  displayName: string;
  salaryCycle: SalaryCycle;
  primaryIncomeType: IncomeType;
  riskComfort: RiskComfort;
  investmentHorizonMonths: string;
  investmentHorizonValue: string;
  investmentHorizonUnit: "months" | "years";
};

type AccountSetupState = {
  name: string;
  type: Account["type"];
  institutionName: string;
  openingBalance: string;
};

type GoalSetupState = {
  enabled: boolean;
  name: string;
  goalType: GoalType;
  targetAmount: string;
  targetDate: string;
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

const incomeTypeLabels: Record<IncomeType, string> = {
  salary: "Salary only",
  salary_plus_side_income: "Salary plus side income",
  services: "Services / freelance",
};

const salaryCycleLabels: Record<SalaryCycle, string> = {
  month_end: "End of month",
  mid_month: "Mid month",
  custom: "Varies",
};

const riskComfortLabels: Record<RiskComfort, string> = {
  low: "Low — I prefer safety and liquidity",
  moderate: "Moderate — I can handle some ups and downs",
  high: "High — I am comfortable with long-term volatility",
};

const steps: OnboardingStep[] = ["profile", "account", "goal"];

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

function convertHorizonToMonths(value: string, unit: "months" | "years") {
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

  return null;
}

export function OnboardingWorkspace() {
  const router = useRouter();
  const [form, setForm] = useState<OnboardingFormState>(defaultForm);
  const [account, setAccount] = useState<AccountSetupState>(defaultAccount);
  const [goal, setGoal] = useState<GoalSetupState>({
    ...defaultGoal,
    targetDate: defaultGoalDate(),
  });
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
    () => getStepError({ step, profile: form, account, goal, consentGiven }),
    [account, consentGiven, form, goal, step],
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

    const finalError = getStepError({ step: "goal", profile: form, account, goal, consentGiven });
    if (finalError) {
      setError(finalError);
      return;
    }

    setIsSubmitting(true);

    try {
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

      await repositories.userProfile.save(profile);
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

  if (isChecking) {
    return null;
  }

  if (mode === "choose") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Get back into Moat</h1>
          <p className="text-sm text-muted-foreground">
            Start fresh on this device or restore an encrypted backup you already control.
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setMode("fresh")}
            className="grid gap-1 border border-border/30 px-4 py-4 text-left"
          >
            <div className="text-sm text-foreground">Start fresh</div>
            <div className="text-sm text-muted-foreground">
              Create a new local profile, first account, and optional first goal on this device.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("restore_file")}
            className="grid gap-1 border border-border/30 px-4 py-4 text-left"
          >
            <div className="text-sm text-foreground">Restore encrypted file</div>
            <div className="text-sm text-muted-foreground">
              Use a backup file you previously downloaded and restore it with your backup PIN.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("restore_drive")}
            className="grid gap-1 border border-border/30 px-4 py-4 text-left"
          >
            <div className="text-sm text-foreground">Restore from Google Drive</div>
            <div className="text-sm text-muted-foreground">
              Connect Google Drive, choose a Moat backup, and restore it with your backup PIN.
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "restore_file" || mode === "restore_drive") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "restore_file" ? "Restore your backup file" : "Restore from Google Drive"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Restore first, then continue in the app with the same local-first storage model.
          </p>
        </div>

        <OnboardingRecoveryPanel
          mode={mode === "restore_file" ? "file" : "drive"}
          onBack={() => setMode("choose")}
          onRestored={() => {
            clearDraft();
            router.replace("/");
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {steps.map((currentStep, index) => (
            <div
              key={currentStep}
              className={`rounded-full border px-3 py-1 ${
                index <= stepIndex ? "border-primary text-foreground" : "border-border/30"
              }`}
            >
              {index + 1}. {currentStep === "profile" ? "Profile" : currentStep === "account" ? "First account" : "First goal"}
            </div>
          ))}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === "profile"
            ? "Set up your profile"
            : step === "account"
              ? "Add your first account"
              : "Add your first goal"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === "profile"
            ? "Start with the basics. This stays local to your device."
            : step === "account"
              ? "A first account makes the ledger immediately usable."
              : "Goals are optional, but adding one makes the dashboard more useful on day one."}
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/40 shadow-none">
        <CardContent className="pt-6">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            {step === "profile" ? (
              <>
                <InputField
                  id="display-name"
                  label="Your name or nickname"
                  value={form.displayName}
                  onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
                  placeholder="e.g. Piira"
                  autoComplete="off"
                  required
                />

                <SelectField
                  id="income-type"
                  label="How do you earn money?"
                  value={form.primaryIncomeType}
                  options={optionsFromRecord(incomeTypeLabels)}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, primaryIncomeType: v as IncomeType }))
                  }
                />

                <SelectField
                  id="salary-cycle"
                  label="When does your salary usually arrive?"
                  value={form.salaryCycle}
                  options={optionsFromRecord(salaryCycleLabels)}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, salaryCycle: v as SalaryCycle }))
                  }
                />

                <SelectField
                  id="risk-comfort"
                  label="How do you feel about financial risk?"
                  value={form.riskComfort}
                  options={optionsFromRecord(riskComfortLabels)}
                  onValueChange={(v) =>
                    setForm((c) => ({ ...c, riskComfort: v as RiskComfort }))
                  }
                />

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <div className="text-sm font-medium text-foreground">
                      How far ahead are you planning?
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {HORIZON_PRESETS.map((preset) => (
                        <button
                          key={`${preset.value}-${preset.unit}`}
                          type="button"
                          onClick={() => {
                            setForm((c) => ({
                              ...c,
                              investmentHorizonValue: preset.value,
                              investmentHorizonUnit: preset.unit,
                              investmentHorizonMonths: String(
                                convertHorizonToMonths(preset.value, preset.unit),
                              ),
                            }));
                          }}
                          className={`rounded-full border px-3 py-1 text-sm ${
                            form.investmentHorizonValue === preset.value &&
                            form.investmentHorizonUnit === preset.unit
                              ? "border-primary text-foreground"
                              : "border-border/30 text-muted-foreground"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <InputField
                      id="horizon"
                      label="Planning horizon"
                      inputMode="numeric"
                      min="1"
                      value={form.investmentHorizonValue ?? ""}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          investmentHorizonValue: e.target.value,
                          investmentHorizonMonths: String(
                            convertHorizonToMonths(e.target.value, c.investmentHorizonUnit),
                          ),
                        }))
                      }
                      placeholder={form.investmentHorizonUnit === "years" ? "e.g. 2" : "e.g. 24"}
                      hint="Used to calibrate investment guidance and longer-term planning."
                      required
                    />
                    <div className="grid items-start">
                      <SelectField
                        id="horizon-unit"
                        label="Unit"
                        value={form.investmentHorizonUnit ?? "years"}
                        options={[
                          { value: "months", label: "Months" },
                          { value: "years", label: "Years" },
                        ]}
                        onValueChange={(value) =>
                          setForm((c) => ({
                            ...c,
                            investmentHorizonUnit: value as "months" | "years",
                            investmentHorizonMonths: String(
                              convertHorizonToMonths(
                                c.investmentHorizonValue,
                                value as "months" | "years",
                              ),
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-4 py-3">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    required
                  />
                  <label
                    htmlFor="consent"
                    className="cursor-pointer text-xs leading-relaxed text-muted-foreground"
                  >
                    I understand my financial data stays on this device by default, and I consent
                    to storing the data I enter. I have read the{" "}
                    <Link
                      href="/privacy"
                      className="inline underline underline-offset-4 hover:text-foreground"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
              </>
            ) : null}

            {step === "account" ? (
              <>
                <InputField
                  id="account-name"
                  label="Account name"
                  value={account.name}
                  onChange={(e) => setAccount((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. MTN Mobile Money"
                  hint="Start with the place where most of your day-to-day money moves."
                  required
                />

                <SelectField
                  id="account-type"
                  label="Account type"
                  value={account.type}
                  options={defaultAccountTypes.map((type) => ({
                    value: type,
                    label:
                      type === "mobile_money"
                        ? "Mobile Money"
                        : type === "bank"
                          ? "Bank Account"
                          : type === "sacco"
                            ? "SACCO"
                            : type === "investment"
                              ? "Investment"
                              : type === "debt"
                                ? "Debt / Obligation"
                                : "Cash",
                  }))}
                  onValueChange={(value) =>
                    setAccount((c) => ({ ...c, type: value as Account["type"] }))
                  }
                />

                <InputField
                  id="institution-name"
                  label="Institution name"
                  value={account.institutionName}
                  onChange={(e) =>
                    setAccount((c) => ({ ...c, institutionName: e.target.value }))
                  }
                  placeholder="Optional — e.g. Stanbic, MTN, your SACCO"
                />

                <InputField
                  id="opening-balance"
                  label={`Opening balance (${account.type === "debt" ? "owed" : "available"}) in UGX`}
                  inputMode="decimal"
                  value={account.openingBalance}
                  onChange={(e) =>
                    setAccount((c) => ({ ...c, openingBalance: e.target.value }))
                  }
                  hint={
                    account.type === "debt"
                      ? "Debt balances are stored as negative starting balances."
                      : "This becomes your starting point before any transactions are added."
                  }
                  required
                />
              </>
            ) : null}

            {step === "goal" ? (
              <>
                <div className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-4 py-3">
                  <input
                    id="goal-enabled"
                    type="checkbox"
                    checked={goal.enabled}
                    onChange={(e) => setGoal((c) => ({ ...c, enabled: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <label
                    htmlFor="goal-enabled"
                    className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
                  >
                    Add my first goal now
                  </label>
                </div>

                {goal.enabled ? (
                  <>
                    <InputField
                      id="goal-name"
                      label="Goal name"
                      value={goal.name}
                      onChange={(e) => setGoal((c) => ({ ...c, name: e.target.value }))}
                      placeholder="e.g. Emergency savings"
                      required
                    />

                    <SelectField
                      id="goal-type"
                      label="Goal type"
                      value={goal.goalType}
                      options={optionsFromRecord(goalTypeLabels, defaultGoalTypes)}
                      onValueChange={(value) =>
                        setGoal((c) => ({ ...c, goalType: value as GoalType }))
                      }
                    />

                    <InputField
                      id="goal-target-amount"
                      label="Target amount (UGX)"
                      inputMode="decimal"
                      value={goal.targetAmount}
                      onChange={(e) =>
                        setGoal((c) => ({ ...c, targetAmount: e.target.value }))
                      }
                      placeholder="e.g. 500000"
                      required
                    />

                    <InputField
                      id="goal-target-date"
                      type="date"
                      label="Target date"
                      value={goal.targetDate}
                      onChange={(e) => setGoal((c) => ({ ...c, targetDate: e.target.value }))}
                      required
                    />
                  </>
                ) : (
                  <div className="rounded-md border border-border/30 px-4 py-3 text-sm text-muted-foreground">
                    Skipping this is fine. You can add goals later once your first transactions are
                    in.
                  </div>
                )}
              </>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : null}

              {step !== "goal" ? (
                <Button type="button" onClick={() => void handleNext()}>
                  Continue
                </Button>
              ) : (
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Setting up..." : "Start tracking"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        No account required. Progress is saved locally while you set up.
      </p>
    </div>
  );
}
