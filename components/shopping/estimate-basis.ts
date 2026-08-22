import { formatMoneyShort } from "@/lib/currency";
import type { PlannedEstimate } from "@/lib/domain/planned-purchases";

// Says how much of the figure is a guess. A total that mixes prices you set with
// prices it remembered is worth less if you cannot tell which is which.
export function estimateBasis(estimate: PlannedEstimate): string {
  if (estimate.total === 0 && estimate.unknownCount === 0) {
    return "Nothing planned yet.";
  }

  const parts: string[] = [];
  if (estimate.remembered > 0) {
    parts.push(`${formatMoneyShort(estimate.remembered)} of it from what you last paid`);
  }
  if (estimate.unknownCount > 0) {
    parts.push(
      `${estimate.unknownCount} ${estimate.unknownCount === 1 ? "item has" : "items have"} no price yet`,
    );
  }

  return parts.length > 0 ? `${parts.join(", and ")}.` : "All from prices you set.";
}
