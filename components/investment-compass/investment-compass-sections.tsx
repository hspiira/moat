"use client";

import Link from "next/link";
import { useState } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { MoatRing } from "@/components/moat/moat-ring";
import { Money } from "@/components/ui/money";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { Button } from "@/components/ui/button";
import { FormCardShell } from "@/components/forms/form-card-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  guidanceLevelLabels,
  liquidityNeedLabels,
  optionsFromRecord,
  riskComfortLabels,
} from "@/lib/select-options";
import type { InvestmentProfile, ResourceLink } from "@/lib/types";

import type { InvestmentProfileFormState } from "./use-investment-compass-workspace";

export const goalFocusOptions: { value: InvestmentProfile["goalFocus"]; label: string }[] = [
  { value: "general_wealth", label: "General wealth" },
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "rent_buffer", label: "Rent buffer" },
  { value: "school_fees", label: "School fees" },
  { value: "land_savings", label: "Land savings" },
  { value: "business_capital", label: "Business capital" },
  { value: "education", label: "Education" },
  { value: "house_construction", label: "House / Construction" },
];

export function InvestmentEmptyState() {
  return (
    <Card className="shadow-none">
      <CardContent className="grid gap-4 px-5 py-8 text-sm text-muted-foreground">
        <p>
          Complete onboarding so the compass can read your time horizon, goals, and transaction
          history.
        </p>
        <Button asChild size="sm">
          <Link href="/onboarding">Set up your profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function InvestmentMetricCards({
  monthlyOutflow,
  emergencyFundMonthsCovered,
}: {
  monthlyOutflow: number;
  emergencyFundMonthsCovered: number;
}) {
  if (monthlyOutflow <= 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="grid gap-6 px-5 py-5 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-8">
        <MoatRing
          value={emergencyFundMonthsCovered / 3}
          tone={emergencyFundMonthsCovered >= 3 ? "positive" : "moat"}
          ariaLabel={`Emergency fund goal: ${emergencyFundMonthsCovered.toFixed(1)} of 3 target months`}
          label={emergencyFundMonthsCovered.toFixed(1)}
          sublabel="months"
          size={104}
          thickness={9}
          className="justify-self-center sm:justify-self-start"
        />
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Emergency fund goal</p>
          {emergencyFundMonthsCovered > 0 ? (
            <p className="text-xl font-semibold">
              {emergencyFundMonthsCovered.toFixed(1)} month
              {emergencyFundMonthsCovered !== 1 ? "s" : ""}
              <span className="text-sm font-normal text-muted-foreground"> of 3 target</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not started. This tracks a savings goal, not the balances on your home screen.
            </p>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Monthly outflow baseline</p>
          <Money amount={monthlyOutflow} tone="negative" className="text-xl font-semibold" />
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function answerSummary(form: InvestmentProfileFormState) {
  const months = Number(form.timeHorizonMonths);
  return [
    {
      label: "Needed in",
      value: Number.isFinite(months) && months > 0 ? `${months} months` : "Not set",
    },
    { label: "How soon you may need it", value: liquidityNeedLabels[form.liquidityNeed] },
    { label: "Comfort if the value falls", value: riskComfortLabels[form.riskComfort] },
    {
      label: "What it is for",
      value:
        goalFocusOptions.find((option) => option.value === form.goalFocus)?.label ??
        "General wealth",
    },
    { label: "How much detail", value: guidanceLevelLabels[form.guidanceLevel] },
  ];
}

export function InvestmentProfileCard({
  form,
  isSubmitting,
  lastSavedAt,
  successMessage,
  onFormChange,
  onSubmit,
}: {
  form: InvestmentProfileFormState;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  onFormChange: (updater: (current: InvestmentProfileFormState) => InvestmentProfileFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="grid content-start gap-3">
      <AppAnswersHeading />

      <div className="grid">
        {answerSummary(form).map((answer) => (
          <AnswerRow key={answer.label} label={answer.label} value={answer.value} />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => setIsEditing(true)}
      >
        Change your answers
      </Button>

      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Change your answers</SheetTitle>
            <SheetDescription>These five answers decide what is suggested.</SheetDescription>
          </SheetHeader>
          <FormCardShell
            embedded
            title="Change your answers"
            description="These five answers decide what is suggested below."
            footer={
              <Button
                type="submit"
                size="lg"
                form="investment-profile-form"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Saving..." : "Save answers"}
              </Button>
            }
          >
            <form
              id="investment-profile-form"
              className="grid gap-4"
              onSubmit={(event) => {
                onSubmit(event);
                setIsEditing(false);
              }}
            >
              <LocalSaveFeedback
                isSubmitting={isSubmitting}
                lastSavedAt={lastSavedAt}
                successMessage={successMessage}
              />

              <InputField
                id="time-horizon"
                label="Needed in (months)"
                inputMode="numeric"
                min="1"
                value={form.timeHorizonMonths}
                onChange={(event) =>
                  onFormChange((current) => ({ ...current, timeHorizonMonths: event.target.value }))
                }
                required
              />

              <SelectField
                id="liquidity-need"
                label="How soon you may need it"
                value={form.liquidityNeed}
                options={optionsFromRecord(liquidityNeedLabels)}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    liquidityNeed: value as InvestmentProfileFormState["liquidityNeed"],
                  }))
                }
              />

              <SelectField
                id="risk-comfort"
                label="Comfort if the value falls"
                value={form.riskComfort}
                options={optionsFromRecord(riskComfortLabels)}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    riskComfort: value as InvestmentProfileFormState["riskComfort"],
                  }))
                }
              />

              <SelectField
                id="goal-focus"
                label="What it is for"
                value={form.goalFocus}
                options={goalFocusOptions}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    goalFocus: value as InvestmentProfile["goalFocus"],
                  }))
                }
              />

              <SelectField
                id="guidance-level"
                label="How much detail"
                value={form.guidanceLevel}
                options={optionsFromRecord(guidanceLevelLabels)}
                onValueChange={(value) =>
                  onFormChange((current) => ({
                    ...current,
                    guidanceLevel: value as InvestmentProfileFormState["guidanceLevel"],
                  }))
                }
              />
            </form>
          </FormCardShell>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AppAnswersHeading() {
  return (
    <div className="grid gap-0.5">
      <h3 className="font-display text-base font-semibold">What this is based on</h3>
      <p className="text-xs leading-5 text-muted-foreground">
        Change any answer and the suggestions below change with it.
      </p>
    </div>
  );
}

export function InvestmentGuidancePanels({
  recommendedProducts,
  rationale,
  removals,
  warnings,
  regulatedResources,
}: {
  recommendedProducts: string[];
  rationale: string[];
  removals: string[];
  warnings: string[];
  regulatedResources: ResourceLink[];
}) {
  return (
    <div className="grid gap-4 content-start">
      <Card>
        <CardHeader>
          <CardTitle>Suggested product classes</CardTitle>
          <CardDescription>
            These are regulated or capital-preserving categories, not specific product recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {recommendedProducts.map((product) => (
            <div
              key={product}
              className="bg-muted/30 px-4 py-3 text-sm text-foreground"
            >
              {product}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Why this guidance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm leading-6 text-muted-foreground">
          {rationale.map((item) => (
            <p key={item}>{item}</p>
          ))}
          {removals.length > 0 ? (
            <ul className="grid gap-1 pt-1">
              {removals.map((removal) => (
                <li key={removal} className="text-xs">
                  {removal}
                </li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <div className="mt-1 grid gap-2 border border-amber-300/40 bg-amber-50/60 px-4 py-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {warnings.map((warning) => (
                <p key={warning} className="text-sm">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {regulatedResources.length > 0 ? (
        <Card className="shadow-none">
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
                className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-sm transition-colors hover:hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium text-foreground">{resource.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{resource.sourceName}</div>
                </div>
                {resource.isOfficial ? (
                  <span className="shrink-0 px-2 py-0.5 text-xs text-muted-foreground">
                    Official
                  </span>
                ) : null}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
