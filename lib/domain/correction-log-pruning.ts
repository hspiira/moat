import type { CorrectionLog } from "@/lib/types";

// A correction is only useful while you might still turn it into a rule. Keeping
// every one forever grows the store for no gain, so the newest are kept and the
// rest go.
export const CORRECTIONS_KEPT = 50;

export function getCorrectionsToPrune(
  logs: CorrectionLog[],
  keep = CORRECTIONS_KEPT,
): CorrectionLog[] {
  return newestFirst(logs).slice(keep);
}

export function newestFirst(logs: CorrectionLog[]): CorrectionLog[] {
  return [...logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
