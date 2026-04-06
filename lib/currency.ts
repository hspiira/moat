import type { SupportedCurrency } from "@/lib/types";

export const supportedCurrencyLabels: Record<SupportedCurrency, string> = {
  UGX: "UGX",
  USD: "USD",
  KES: "KES",
  TZS: "TZS",
  RWF: "RWF",
  EUR: "EUR",
  GBP: "GBP",
};

export function formatMoney(amount: number, currency: SupportedCurrency = "UGX") {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "UGX" ? 0 : 2,
  }).format(amount);
}

export function normalizeAmountToUgx(
  originalAmount: number,
  currency: SupportedCurrency,
  fxRateToUgx?: number,
) {
  if (currency === "UGX") {
    return Math.abs(originalAmount);
  }

  const rate = Number(fxRateToUgx);
  if (!Number.isFinite(rate) || rate <= 0) {
    return Number.NaN;
  }

  return Math.abs(originalAmount) * rate;
}
