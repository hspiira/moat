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

// "Sh" for a list of transactions, where the symbol repeats on every row and
// the page has already said which currency it is. Balances keep the full "USh".
// Derived from formatMoney so grouping and the non-breaking space cannot drift
// apart from it. Only UGX has a short form; anything else keeps its symbol.
export function formatMoneyShort(amount: number, currency: SupportedCurrency = "UGX") {
  const full = formatMoney(amount, currency);
  return currency === "UGX" ? full.replace("USh", "Sh") : full;
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

  return Math.round(Math.abs(originalAmount) * rate);
}
