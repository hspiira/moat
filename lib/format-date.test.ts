import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatDateTime, formatDayHeading } from "@/lib/format-date";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-18T09:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatDayHeading", () => {
  it("names the day and spells the month out", () => {
    expect(formatDayHeading("2026-08-17")).toBe("Monday, 17 August");
  });

  it("adds the year once the date is not this year", () => {
    expect(formatDayHeading("2025-12-31")).toBe("Wednesday, 31 December 2025");
  });

  it("adds the year on request", () => {
    expect(formatDayHeading("2026-08-17", { alwaysYear: true })).toBe("Monday, 17 August 2026");
  });

  it("hands back anything it cannot read", () => {
    expect(formatDayHeading("")).toBe("");
    expect(formatDayHeading("not a date")).toBe("not a date");
  });
});

describe("formatDate", () => {
  it("still reads short, for the places that sit beside other text", () => {
    expect(formatDate("2026-08-17")).toBe("17 Aug");
    expect(formatDate("2025-12-31")).toBe("31 Dec 2025");
  });
});

describe("formatDateTime", () => {
  /* Repeats of one captured message usually land on the same day, so a date on
     its own would print the same line five times. */
  it("says the time as well as the day", () => {
    const shown = formatDateTime("2026-04-07T14:35:00.000Z");

    expect(shown).toContain("Apr");
    expect(shown).toMatch(/\d{1,2}:\d{2}/);
  });

  it("gives two arrivals on one day different lines", () => {
    expect(formatDateTime("2026-04-07T09:00:00.000Z")).not.toBe(
      formatDateTime("2026-04-07T14:00:00.000Z"),
    );
  });

  it("says nothing for nothing", () => {
    expect(formatDateTime("")).toBe("");
  });

  it("hands back what it cannot read rather than Invalid Date", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });
});
