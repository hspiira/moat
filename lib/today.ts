/**
 * Today, in the device's timezone.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC, which is the wrong day for
 * part of every day: in Kampala (UTC+3) anything recorded between midnight and
 * 03:00 gets stamped yesterday.
 *
 * These are functions, not constants, on purpose. A module-level constant is
 * evaluated once when the bundle loads, so an installed PWA left open across
 * midnight keeps offering the previous day until it is restarted.
 */

export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The current month as `YYYY-MM`, in the device's timezone. */
export function currentMonthIso(now: Date = new Date()): string {
  return todayIso(now).slice(0, 7);
}
