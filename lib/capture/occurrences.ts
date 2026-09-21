import type { CaptureReviewItem } from "@/lib/types";

/**
 * Enough to show that something is repeating without letting a runaway
 * automation grow one row without end. The count keeps rising past this; only
 * the list of moments is trimmed, oldest first.
 */
const MAX_REMEMBERED_OCCURRENCES = 50;

export function occurrenceCountOf(item: CaptureReviewItem): number {
  return Math.max(1, item.occurrenceCount ?? 1);
}

/**
 * The same message arriving again, counted onto the row already waiting.
 *
 * The moments are kept so the count can be accounted for: a row saying five
 * without saying when is a number nobody can check.
 */
export function countAnotherOccurrence(
  item: CaptureReviewItem,
  capturedAt: string,
): CaptureReviewItem {
  const known = item.occurrenceCapturedAt ?? [item.createdAt];
  const moments = [...known, capturedAt].slice(-MAX_REMEMBERED_OCCURRENCES);

  return {
    ...item,
    occurrenceCount: occurrenceCountOf(item) + 1,
    occurrenceCapturedAt: moments,
    updatedAt: capturedAt,
  };
}
