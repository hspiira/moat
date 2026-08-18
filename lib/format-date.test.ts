import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatDayHeading } from "@/lib/format-date";

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
