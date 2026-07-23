/**
 * Small, shared form validators. Each returns a user-facing error string, or
 * null when the value is acceptable — so callers can drive field-level errors.
 */

type AmountOptions = {
  /** Allow exactly zero (e.g. an opening balance). Default false. */
  allowZero?: boolean;
  /** Allow negative values (e.g. a debt opening balance). Default false. */
  allowNegative?: boolean;
  /** Message when the field is empty. Default "Enter an amount." */
  requiredMessage?: string;
};

/** Validate a money/number input typed as a string. */
export function validateAmount(raw: string, options: AmountOptions = {}): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return options.requiredMessage ?? "Enter an amount.";
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return "Enter a valid number.";
  }
  if (!options.allowNegative && value < 0) {
    return "This can't be negative.";
  }
  if (!options.allowZero && value === 0) {
    return "Enter an amount greater than zero.";
  }
  return null;
}

/** Validate an integer within an inclusive range. */
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

/** True when an ISO date string (YYYY-MM-DD) is strictly before today. */
export function isPastDate(iso: string): boolean {
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso < today;
}
