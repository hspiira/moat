import { todayIso } from "@/lib/today";

import { parseAmountInput } from "@/lib/parse-amount";

type AmountOptions = {
  allowZero?: boolean;
  allowNegative?: boolean;
  requiredMessage?: string;
  allowFraction?: boolean;
};

export function validateAmount(raw: string, options: AmountOptions = {}): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return options.requiredMessage ?? "Enter an amount.";
  }
  const value = parseAmountInput(trimmed);
  if (value === null) {
    return "Enter a valid number.";
  }
  if (!options.allowNegative && value < 0) {
    return "This can't be negative.";
  }
  if (!options.allowZero && value === 0) {
    return "Enter an amount greater than zero.";
  }
  if (!options.allowFraction && !Number.isInteger(value)) {
    return "Enter a whole number of shillings.";
  }
  return null;
}

export function validateInteger(
  raw: string,
  min: number,
  max: number,
  requiredMessage = "Enter a number.",
): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return requiredMessage;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    return "Enter a whole number.";
  }
  if (value < min || value > max) {
    return `Enter a number between ${min} and ${max}.`;
  }
  return null;
}

export function isPastDate(iso: string): boolean {
  if (!iso) return false;
  const today = todayIso();
  return iso < today;
}
