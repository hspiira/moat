"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { IncomeType, RiskComfort, SalaryCycle, UserProfile } from "@/lib/types";
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

function buildTimestamp() {
  return new Date().toISOString();
}

export function OnboardingWorkspace() {
  const router = useRouter();
  const [form, setForm] = useState<OnboardingFormState>(defaultForm);
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
            <div className="grid gap-2">
              <Label htmlFor="display-name">Your name or nickname</Label>
              <Input
                id="display-name"
                value={form.displayName}
                onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
                placeholder="e.g. Piira"
                autoComplete="off"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="income-type">How do you earn money?</Label>
              <Select
                value={form.primaryIncomeType}
                onValueChange={(v) =>
                  setForm((c) => ({ ...c, primaryIncomeType: v as IncomeType }))
                }
              >
                <SelectTrigger id="income-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary only</SelectItem>
                  <SelectItem value="salary_plus_side_income">
                    Salary plus side income
                  </SelectItem>
                  <SelectItem value="services">Services / freelance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="salary-cycle">When does your salary arrive?</Label>
              <Select
                value={form.salaryCycle}
                onValueChange={(v) =>
                  setForm((c) => ({ ...c, salaryCycle: v as SalaryCycle }))
                }
              >
                <SelectTrigger id="salary-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month_end">End of month</SelectItem>
                  <SelectItem value="mid_month">Mid month</SelectItem>
                  <SelectItem value="custom">Varies</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="risk-comfort">How do you feel about financial risk?</Label>
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
                  <SelectItem value="low">
                    Low — I prefer safety and liquidity
                  </SelectItem>
                  <SelectItem value="moderate">
                    Moderate — I can handle some ups and downs
                  </SelectItem>
                  <SelectItem value="high">
                    High — I am comfortable with long-term volatility
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="horizon">
                How many months ahead are you planning for?
              </Label>
              <Input
                id="horizon"
                inputMode="numeric"
                min="1"
                value={form.investmentHorizonMonths}
                onChange={(e) =>
                  setForm((c) => ({ ...c, investmentHorizonMonths: e.target.value }))
                }
                placeholder="e.g. 36 for 3 years"
                required
              />
              <p className="text-xs text-muted-foreground">
                This helps calibrate the Investment Compass for your timeline.
              </p>
            </div>

            <Button disabled={isSubmitting} type="submit" className="w-full">
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
