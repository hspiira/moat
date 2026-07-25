import type { CaptureProviderResult } from "@/lib/capture/types";
import {
  cleanCapturePayee,
  normalizeCurrency,
  parseAmount,
  parseCaptureFee,
  toIsoDate,
} from "@/lib/capture/providers/shared";

export function parseAirtelMoneyUgandaMessage(text: string): CaptureProviderResult | null {
  const deposit = text.match(
    /cash deposit of\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)\.\s/i,
  );
  if (deposit) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-deposit",
      type: "income",
      currency: normalizeCurrency(deposit[1]),
      originalAmount: parseAmount(deposit[2]),
      payee: cleanCapturePayee(deposit[3] ?? ""),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const paid = text.match(
    /PAID\.TID\s+\d+\.\s*(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)\s+Mobile App Charge/i,
  );
  if (paid) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-paid",
      type: "expense",
      currency: normalizeCurrency(paid[1]),
      originalAmount: parseAmount(paid[2]),
      payee: cleanCapturePayee(paid[3] ?? ""),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
    };
  }

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
      payee: cleanCapturePayee(incoming[3] ?? ""),
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
      payee: cleanCapturePayee(outgoing[3] ?? ""),
      occurredOn: toIsoDate(outgoing[4]),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
    };
  }

  return null;
}
