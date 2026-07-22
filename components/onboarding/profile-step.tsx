"use client";

import Link from "next/link";

import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { optionsFromRecord } from "@/lib/select-options";
import type { IncomeType, RiskComfort, SalaryCycle } from "@/lib/types";

import {
  convertHorizonToMonths,
  type OnboardingFormState,
} from "./use-onboarding-workspace";

const HORIZON_PRESETS = [
  { value: "12", unit: "months" as const, label: "12 months" },
  { value: "2", unit: "years" as const, label: "2 years" },
  { value: "3", unit: "years" as const, label: "3 years" },
  { value: "5", unit: "years" as const, label: "5 years" },
];

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

type Props = {
  form: OnboardingFormState;
  onFormChange: (updater: (prev: OnboardingFormState) => OnboardingFormState) => void;
  consentGiven: boolean;
  onConsentChange: (value: boolean) => void;
};

export function ProfileStep({ form, onFormChange, consentGiven, onConsentChange }: Props) {
  return (
    <>
      <InputField
        id="display-name"
        label="Your name or nickname"
        value={form.displayName}
        onChange={(e) => onFormChange((c) => ({ ...c, displayName: e.target.value }))}
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
          onFormChange((c) => ({ ...c, primaryIncomeType: v as IncomeType }))
        }
      />

      <SelectField
        id="salary-cycle"
        label="When does your salary usually arrive?"
        value={form.salaryCycle}
        options={optionsFromRecord(salaryCycleLabels)}
        onValueChange={(v) =>
          onFormChange((c) => ({ ...c, salaryCycle: v as SalaryCycle }))
        }
      />

      <SelectField
        id="risk-comfort"
        label="How do you feel about financial risk?"
        value={form.riskComfort}
        options={optionsFromRecord(riskComfortLabels)}
        onValueChange={(v) =>
          onFormChange((c) => ({ ...c, riskComfort: v as RiskComfort }))
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
                  onFormChange((c) => ({
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
              onFormChange((c) => ({
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
                onFormChange((c) => ({
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
          onChange={(e) => onConsentChange(e.target.checked)}
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
  );
}
