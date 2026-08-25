/**
 * A capture's claimed moment, however it arrived.
 *
 * This becomes the stored and synced timestamp on the review item, and every
 * route into capture is something a person wired up by hand, so a value that is
 * not a date must not be written. Dropped rather than refused, because the
 * message is worth more than the time it claims to be from and the review item
 * already falls back to now when none is given.
 */
export function readCaptureTimestamp(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return Number.isNaN(new Date(trimmed).getTime()) ? undefined : trimmed;
}
