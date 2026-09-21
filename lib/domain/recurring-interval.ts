import type { RecurringInterval, RecurringObligation } from "@/lib/types";

export type RecurringIntervalUnit = RecurringInterval["unit"];

export type { RecurringInterval };

export const recurringIntervalUnits: RecurringIntervalUnit[] = ["week", "month", "year"];

const MAX_EVERY = 60;

export function normaliseInterval(interval: Partial<RecurringInterval> | undefined): RecurringInterval {
  const every = Math.min(MAX_EVERY, Math.max(1, Math.trunc(Number(interval?.every ?? 1)) || 1));
  const unit = recurringIntervalUnits.includes(interval?.unit as RecurringIntervalUnit)
    ? (interval?.unit as RecurringIntervalUnit)
    : "month";

  return { every, unit };
}

/**
 * What an obligation actually repeats on.
 *
 * `cadence` held "weekly", "monthly" or "custom", and custom carried no data at
 * all, so anything that was not one of the two shapes could not be described.
 * The interval is what is read now; cadence is still understood so obligations
 * stored before it keep working.
 */
export function resolveInterval(
  obligation: Pick<RecurringObligation, "cadence" | "interval">,
): RecurringInterval {
  if (obligation.interval) return normaliseInterval(obligation.interval);
  if (obligation.cadence === "weekly") return { every: 1, unit: "week" };
  return { every: 1, unit: "month" };
}

export function describeInterval(interval: RecurringInterval): string {
  const { every, unit } = normaliseInterval(interval);

  if (every === 1) {
    return unit === "week" ? "every week" : unit === "month" ? "every month" : "every year";
  }

  return `every ${every} ${unit}s`;
}

function monthIndex(period: string): number {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + (month - 1);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function daysInPeriod(period: string): string[] {
  const [year, month] = period.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from(
    { length: count },
    (_, index) => `${period}-${String(index + 1).padStart(2, "0")}`,
  );
}

/**
 * How many times this falls due inside a month.
 *
 * The rest of the recurring engine reasons in months, so a weekly obligation is
 * not "in some months and not others": it is in every month, two or three times.
 * Saying so is what lets a month's expected amount be right rather than one
 * payment short.
 */
export function occurrencesInPeriod(params: {
  interval: RecurringInterval;
  startsOn?: string;
  period: string;
}): number {
  const interval = normaliseInterval(params.interval);
  const start = params.startsOn?.slice(0, 10);

  if (interval.unit === "week") {
    if (!start) return Math.floor(daysInPeriod(params.period).length / (7 * interval.every));

    return daysInPeriod(params.period).filter((day) => {
      const since = daysBetween(start, day);
      return since >= 0 && since % (7 * interval.every) === 0;
    }).length;
  }

  const months = interval.unit === "year" ? interval.every * 12 : interval.every;
  const startMonth = start?.slice(0, 7);
  if (!startMonth) return monthIndex(params.period) % months === 0 ? 1 : 0;

  const elapsed = monthIndex(params.period) - monthIndex(startMonth);
  return elapsed >= 0 && elapsed % months === 0 ? 1 : 0;
}

export function fallsDueInPeriod(params: {
  interval: RecurringInterval;
  startsOn?: string;
  period: string;
}): boolean {
  return occurrencesInPeriod(params) > 0;
}
