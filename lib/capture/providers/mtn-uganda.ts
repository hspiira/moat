import type { CaptureProviderResult } from "@/lib/capture/types";
import {
  cleanCapturePayee,
  normalizeCurrency,
  parseAmount,
  parseCaptureFee,
  toIsoDate,
} from "@/lib/capture/providers/shared";

export function parseMtnUgandaMessage(text: string): CaptureProviderResult | null {
  if (/you have requested|authorize the transaction/i.test(text)) {
    return null;
  }

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
      payee: cleanCapturePayee(incoming[3] ?? ""),
      occurredOn: toIsoDate(incoming[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const withdrawal = text.match(
    /withdrawn\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+on\s+(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i,
  );
  if (withdrawal) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-withdrawal",
      type: "expense",
      currency: normalizeCurrency(withdrawal[1]),
      originalAmount: parseAmount(withdrawal[2]),
      payee: "Cash withdrawal",
      occurredOn: toIsoDate(withdrawal[3]),
      note: text,
      feeAmount: parseCaptureFee(text),
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
      payee: cleanCapturePayee(outgoing[3] ?? ""),
      occurredOn: toIsoDate(outgoing[4]),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
    };
  }

  return null;
}
