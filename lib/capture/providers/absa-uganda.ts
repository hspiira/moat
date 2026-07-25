import type { CaptureProviderResult } from "@/lib/capture/types";
import { normalizeCurrency, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseAbsaUgandaMessage(text: string): CaptureProviderResult | null {
  const match = text.match(
    /Absa confirms an ATM cash Withdrawal of\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+on\s+Acc.*?on\s+(\d{2}\/\d{2}\/20\d{2})/i,
  );
  if (!match) {
    return null;
  }

  return {
    providerId: "absa-uganda",
    parserLabel: "absa-atm-withdrawal",
    type: "expense",
    currency: normalizeCurrency(match[1]),
    originalAmount: parseAmount(match[2]),
    payee: "ATM cash withdrawal",
    occurredOn: toIsoDate(match[3]),
    note: text,
    confidenceBoost: 0.35,
  };
}
