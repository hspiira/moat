import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { currentMonthIso, todayIso } from "@/lib/today";

describe("todayIso", () => {
  it("reads the device's date, not UTC's", () => {
    const localMidnightish = new Date(2026, 7, 17, 1, 30);
    expect(todayIso(localMidnightish)).toBe("2026-08-17");
    expect(localMidnightish.toISOString().slice(0, 10)).not.toBe("2026-08-17");
  });

  it("reads the local day late at night too", () => {
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

  it("gives the month the same way at year end", () => {
    expect(currentMonthIso(new Date(2026, 11, 31, 23, 59))).toBe("2026-12");
  });
});

describe("date handling across the app", () => {
  it("has no other UTC date stamps", () => {
    const files = execFileSync(
      "git",
      ["ls-files", "app", "components", "lib", "scripts"],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && file !== "lib/today.ts");

    const offenders = files.filter((file) =>
      /toISOString\(\)\s*\.\s*(slice\(0,\s*(10|7)\)|split\("T"\))/.test(readFileSync(file, "utf8")),
    );

    expect(offenders, "use todayIso()/currentMonthIso() from lib/today").toEqual([]);
  });
});
