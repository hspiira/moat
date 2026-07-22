import type { CaptureProviderResult } from "@/lib/capture/types";
import { normalizeCurrency, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseMtnUgandaMessage(text: string): CaptureProviderResult | null {
  const incoming = text.match(
    /received\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (incoming) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-incoming",
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
    /(?:paid|sent)\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (outgoing) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-outgoing",
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
