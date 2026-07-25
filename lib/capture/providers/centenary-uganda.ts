import type { CaptureProviderResult } from "@/lib/capture/types";
import { cleanCapturePayee, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseCentenaryUgandaMessage(text: string): CaptureProviderResult | null {
  const match = text.match(
    /trxn of\s+(-?)\s*([0-9,]+(?:\.[0-9]+)?).*?on\s+(\d{2}[-/]\d{2}[-/]20\d{2}).*?\((.+)\)\.\s*Call/i,
  );
  if (!match) {
    return null;
  }

  const isDebit = match[1] === "-";
  return {
    providerId: "centenary-uganda",
    parserLabel: isDebit ? "centenary-debit" : "centenary-credit",
    type: isDebit ? "expense" : "income",
    currency: "UGX",
    originalAmount: parseAmount(match[2]),
    payee: cleanCapturePayee(match[4] ?? ""),
    occurredOn: toIsoDate(match[3]),
    note: text,
    confidenceBoost: 0.35,
  };
}
