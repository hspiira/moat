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

/**
 * Sums every charge line (fee / tax / charge / excise duty) in a captured
 * message. Returns undefined when the message states no charges. Word-boundary
 * anchored so "recharge" does not count as a charge.
 */
export function parseCaptureFee(text: string): number | undefined {
  const matches = text.matchAll(
    /\b(?:excise\s+duty|fee|tax|charge)s?\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/gi,
  );
  let total = 0;
  let found = false;
  for (const match of matches) {
    total += parseAmount(match[1]);
    found = true;
  }
  return found ? total : undefined;
}

export function toIsoDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = value.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  return undefined;
}
