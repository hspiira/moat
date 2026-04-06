import type { CaptureProviderResult } from "@/lib/capture/types";

import { parseAirtelMoneyUgandaMessage } from "./airtel-money-uganda";
import { parseBankAlertGeneric } from "./bank-alert-generic";
import { parseMtnUgandaMessage } from "./mtn-uganda";

const providerParsers = [
  parseMtnUgandaMessage,
  parseAirtelMoneyUgandaMessage,
  parseBankAlertGeneric,
] as const;

export function parseWithProviderPacks(text: string): CaptureProviderResult | null {
  for (const parser of providerParsers) {
    const result = parser(text);
    if (result) return result;
  }

  return null;
}
