import { describe, expect, it } from "vitest";

import { currentMonthIso, todayIso } from "@/lib/today";

describe("todayIso", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // 01:30 local. East of UTC this instant is still the previous day in UTC,
    // which is what toISOString().slice(0, 10) used to return.
    const justAfterMidnight = new Date(2026, 7, 17, 1, 30);
    expect(todayIso(justAfterMidnight)).toBe("2026-08-17");
  });

  it("reads the local day late at night too", () => {
    // 23:30 local. West of UTC this instant is already tomorrow in UTC.
    expect(todayIso(new Date(2026, 7, 17, 23, 30))).toBe("2026-08-17");
  });

  it("pads single-digit months and days", () => {
    expect(todayIso(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("defaults to now", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentMonthIso", () => {
  it("returns the local month", () => {
    expect(currentMonthIso(new Date(2026, 7, 1, 0, 30))).toBe("2026-08");
  });

  it("does not roll into the previous month just after midnight", () => {
    // The first of the month at 00:30 local is the previous month in UTC+3.
    expect(currentMonthIso(new Date(2026, 8, 1, 0, 30))).toBe("2026-09");
  });
});
