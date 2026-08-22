type FormatOptions = { alwaysYear?: boolean };

function parseIso(iso: string): Date | null {
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearFor(date: Date, options?: FormatOptions): "numeric" | undefined {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return options?.alwaysYear || !sameYear ? "numeric" : undefined;
}

export function formatDate(iso: string, options?: FormatOptions): string {
  if (!iso) return "";
  const date = parseIso(iso);
  if (!date) return iso;
  return date.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: yearFor(date, options),
  });
}

export function formatDayHeading(iso: string, options?: FormatOptions): string {
  if (!iso) return "";
  const date = parseIso(iso);
  if (!date) return iso;
  return date.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: yearFor(date, options),
  });
}

export function formatMonthLabel(period: string): string {
  const month = period.slice(0, 7);
  const date = parseIso(`${month}-01`);
  if (!date) return period;
  return date.toLocaleDateString("en-UG", { month: "long", year: "numeric" });
}
