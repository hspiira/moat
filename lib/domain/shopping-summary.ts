import { formatMoney } from "@/lib/currency";

/**
 * The asides under the shopping headline.
 *
 * Written as notes rather than tiles because they answer different questions
 * from the headline and from each other: what the estimate rests on, what is
 * still unpriced, and what has been bought to date. Three tiles of equal weight
 * made none of them the answer to the page, and one reading zero took a third of
 * the first screen to say nothing.
 */
export function shoppingSummaryNotes(params: {
  basis: string;
  boughtCount: number;
  boughtAmount: number;
}): string[] {
  const notes: string[] = [];

  // The basis already says how many items have no price yet, so a count beside
  // it would say the same thing twice. The tile that used to do so sat directly
  // above the sentence it repeated.
  if (params.basis) notes.push(params.basis);

  // "So far" on purpose: this counts every trip, while the headline counts only
  // what is still to buy. Side by side and unqualified they read as one shop's
  // plan against its outcome, which they are not.
  if (params.boughtCount > 0) {
    notes.push(`${params.boughtCount} bought so far, ${formatMoney(params.boughtAmount)}`);
  }

  return notes;
}
