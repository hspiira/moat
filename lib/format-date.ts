/**
 * Single date formatter for the whole UI, so dates never appear in three
 * different shapes ("21 Jul", "05-07-2026", "2027-06-30") across screens.
 * Same-year dates drop the year; other years keep it. Uganda locale.
 */
export function formatDate(iso: string, options?: { alwaysYear?: boolean }): string {
  if (!iso) return "";
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: options?.alwaysYear || !sameYear ? "numeric" : undefined,
  });
}
