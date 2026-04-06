"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { IncomeType, RiskComfort, SalaryCycle, UserProfile } from "@/lib/types";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { optionsFromRecord } from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const repositories = createIndexedDbRepositories();

type OnboardingFormState = {
  displayName: string;
  salaryCycle: SalaryCycle;
  primaryIncomeType: IncomeType;
  riskComfort: RiskComfort;
  investmentHorizonMonths: string;
};

const defaultForm: OnboardingFormState = {
  displayName: "",
  salaryCycle: "month_end",
  primaryIncomeType: "salary",
  riskComfort: "moderate",
  investmentHorizonMonths: "36",
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

function buildTimestamp() {
  return new Date().toISOString();
}

export function OnboardingWorkspace() {
  const router = useRouter();
  const [form, setForm] = useState<OnboardingFormState>(defaultForm);
  const [consentGiven, setConsentGiven] = useState(false);
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
          }
        })
        .catch(() => null)
        .finally(() => setIsChecking(false));
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = buildTimestamp();
      const profile: UserProfile = {
        id: "user:default",
        displayName: form.displayName.trim(),
        currency: "UGX",
        salaryCycle: form.salaryCycle,
        primaryIncomeType: form.primaryIncomeType,
        riskComfort: form.riskComfort,
        investmentHorizonMonths: Number(form.investmentHorizonMonths),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const bootstrapState = createBootstrapState(profile);

      await repositories.userProfile.save(profile);
      await Promise.all(
        bootstrapState.categories.map((c) => repositories.categories.upsert(c)),
      );
      await repositories.investmentProfiles.save(bootstrapState.investmentProfile);
      await repositories.resources.replaceAll(bootstrapState.resources);

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

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="text-sm text-muted-foreground">
          This takes about two minutes. Your data stays on this device.
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
              label="When does your salary arrive?"
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

            <InputField
              id="horizon"
              label="How many months ahead are you planning for?"
              inputMode="numeric"
              min="1"
              value={form.investmentHorizonMonths}
              onChange={(e) =>
                setForm((c) => ({ ...c, investmentHorizonMonths: e.target.value }))
              }
              placeholder="e.g. 36 for 3 years"
              hint="This helps calibrate the Investment Compass for your timeline."
              required
            />

            <div className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-4 py-3">
              <input
                id="consent"
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                required
              />
              <label htmlFor="consent" className="cursor-pointer text-xs leading-relaxed text-muted-foreground">
                I understand that all my financial data is stored locally on this device only. I
                have read the{" "}
                <Link
                  href="/privacy"
                  className="inline underline underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </Link>{" "}
                and consent to the collection of personal financial data I enter into this app.
              </label>
            </div>

            <Button disabled={isSubmitting || !consentGiven} type="submit" className="w-full">
              {isSubmitting ? "Setting up..." : "Start tracking"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        No account required. All data is stored locally on this device.
      </p>
    </div>
  );
}
