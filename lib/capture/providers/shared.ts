import type { SupportedCurrency } from "@/lib/types";

export function normalizeCurrency(value: string): SupportedCurrency {
  const upper = value.toUpperCase();
  if (upper === "USH") return "UGX";
  if (upper === "UGX" || upper === "USD" || upper === "KES" || upper === "TZS" || upper === "RWF" || upper === "EUR" || upper === "GBP") {
    return upper;
  }
  return "UGX";
}

export function parseAmount(value: string) {
  return Number(value.replace(/,/g, ""));
}

export function toIsoDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = value.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  return undefined;
}
