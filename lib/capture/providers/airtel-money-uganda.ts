import type { CaptureProviderResult } from "@/lib/capture/types";
import type { SupportedCurrency } from "@/lib/types";

function normalizeCurrency(value: string): SupportedCurrency {
  const upper = value.toUpperCase();
  if (upper === "USH") return "UGX";
  if (upper === "UGX" || upper === "USD" || upper === "KES" || upper === "TZS" || upper === "RWF" || upper === "EUR" || upper === "GBP") {
    return upper;
  }
  return "UGX";
}

function parseAmount(value: string) {
  return Number(value.replace(/,/g, ""));
}

function toIsoDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = value.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  return undefined;
}

export function parseAirtelMoneyUgandaMessage(text: string): CaptureProviderResult | null {
  const incoming = text.match(
    /(?:you have received|received)\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (incoming) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-incoming",
      type: "income",
      currency: normalizeCurrency(incoming[1]),
      originalAmount: parseAmount(incoming[2]),
      payee: incoming[3]?.trim(),
      occurredOn: toIsoDate(incoming[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const outgoing = text.match(
    /(?:you have sent|sent|paid)\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (outgoing) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-outgoing",
      type: "expense",
      currency: normalizeCurrency(outgoing[1]),
      originalAmount: parseAmount(outgoing[2]),
      payee: outgoing[3]?.trim(),
      occurredOn: toIsoDate(outgoing[4]),
      note: text,
      confidenceBoost: 0.3,
    };
  }

  return null;
}
