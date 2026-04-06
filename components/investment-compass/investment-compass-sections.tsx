"use client";

import Link from "next/link";

import { AmountIndicator } from "@/components/amount-indicator";
import { AccentCardHeader } from "@/components/accent-card-header";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import { Button } from "@/components/ui/button";
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function InvestmentEmptyState() {
  return (
    <Card className="border-border/40 shadow-none">
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
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="moat-panel-sage border-border/20 shadow-none">
        <CardHeader className="gap-2 p-5">
          <CardDescription className="text-foreground/72">Monthly outflow baseline</CardDescription>
          <CardTitle className="text-xl text-foreground">
            <AmountIndicator
              tone="negative"
              sign="negative"
              value={formatCurrency(monthlyOutflow)}
              className="text-xl font-semibold"
            />
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="moat-panel-mint border-border/20 shadow-none">
        <CardHeader className="gap-2 p-5">
          <CardDescription className="text-foreground/72">Emergency coverage</CardDescription>
          <CardTitle className="text-xl text-foreground">
            <AmountIndicator
              tone={emergencyFundMonthsCovered > 0 ? "positive" : "neutral"}
              sign={emergencyFundMonthsCovered > 0 ? "positive" : "none"}
              value={`${emergencyFundMonthsCovered.toFixed(1)} month${emergencyFundMonthsCovered !== 1 ? "s" : ""}`}
              className="text-xl font-semibold"
            />
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
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
  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title="Your investment profile"
        description="Update these settings to see how guidance changes."
        titleClassName="text-base"
      />
      <CardContent className="p-5">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <LocalSaveFeedback
            isSubmitting={isSubmitting}
            lastSavedAt={lastSavedAt}
            successMessage={successMessage}
          />

          <InputField
            id="time-horizon"
            label="Time horizon (months)"
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
            label="Liquidity need"
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
            label="Risk comfort"
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
            label="Goal focus"
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
            label="Guidance detail"
            value={form.guidanceLevel}
            options={optionsFromRecord(guidanceLevelLabels)}
            onValueChange={(value) =>
              onFormChange((current) => ({
                ...current,
                guidanceLevel: value as InvestmentProfileFormState["guidanceLevel"],
              }))
            }
          />

          <Button disabled={isSubmitting} type="submit" size="sm">
            {isSubmitting ? "Saving..." : "Update profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function InvestmentGuidancePanels({
  recommendedProducts,
  rationale,
  warnings,
  regulatedResources,
}: {
  recommendedProducts: string[];
  rationale: string[];
  warnings: string[];
  regulatedResources: ResourceLink[];
}) {
  return (
    <div className="grid gap-4 content-start">
      <Card className="moat-panel-lilac border-border/20 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Suggested product classes</CardTitle>
          <CardDescription>
            These are regulated or capital-preserving categories, not specific product recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {recommendedProducts.map((product) => (
            <div
              key={product}
              className="border border-border/40 bg-muted/30 px-4 py-3 text-sm text-foreground"
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
          {rationale.map((item) => (
            <p key={item}>{item}</p>
          ))}
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
                className="flex items-center justify-between gap-3 border border-border/40 bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-border/70 hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium text-foreground">{resource.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{resource.sourceName}</div>
                </div>
                {resource.isOfficial ? (
                  <span className="shrink-0 border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
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
