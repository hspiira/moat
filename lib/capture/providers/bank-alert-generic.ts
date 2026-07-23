import type { CaptureProviderResult } from "@/lib/capture/types";
import { normalizeCurrency, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseBankAlertGeneric(text: string): CaptureProviderResult | null {
  const credited = text.match(
    /(?:acct|account).+?credited(?:\s+with)?\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)(?:.*?from\s+(.+?))?(?:.*?on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (credited) {
    return {
      providerId: "bank-alert-generic",
      parserLabel: "bank-credited",
      type: "income",
      currency: normalizeCurrency(credited[1]),
      originalAmount: parseAmount(credited[2]),
      payee: credited[3]?.trim(),
      occurredOn: toIsoDate(credited[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const debited = text.match(
    /(?:acct|account).+?debited(?:\s+by| with)?\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)(?:.*?(?:to|at)\s+(.+?))?(?:.*?on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (debited) {
    return {
      providerId: "bank-alert-generic",
      parserLabel: "bank-debited",
      type: "expense",
      currency: normalizeCurrency(debited[1]),
      originalAmount: parseAmount(debited[2]),
      payee: debited[3]?.trim(),
      occurredOn: toIsoDate(debited[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  return null;
}
