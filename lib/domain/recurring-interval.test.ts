import { describe, expect, it } from "vitest";

import {
  describeInterval,
  fallsDueInPeriod,
  normaliseInterval,
  occurrencesInPeriod,
  resolveInterval,
} from "./recurring-interval";

describe("normaliseInterval", () => {
  it("settles on every month when told nothing", () => {
    expect(normaliseInterval(undefined)).toEqual({ every: 1, unit: "month" });
  });

  /* The count comes from a field someone types into, so it has to survive a
     zero, a fraction and a word without producing a bill due every no months. */
  it("never lets the count fall below one", () => {
    expect(normaliseInterval({ every: 0, unit: "week" }).every).toBe(1);
    expect(normaliseInterval({ every: -4, unit: "week" }).every).toBe(1);
    expect(normaliseInterval({ every: 2.7, unit: "week" }).every).toBe(2);
    expect(normaliseInterval({ every: Number.NaN, unit: "week" }).every).toBe(1);
  });

  it("caps a count nobody meant", () => {
    expect(normaliseInterval({ every: 5000, unit: "month" }).every).toBe(60);
  });

  it("falls back to months when the unit is not one it knows", () => {
    expect(normaliseInterval({ every: 3, unit: "fortnight" as never }).unit).toBe("month");
  });
});

describe("resolveInterval", () => {
  it("reads the interval when there is one", () => {
    expect(resolveInterval({ cadence: "monthly", interval: { every: 3, unit: "week" } })).toEqual({
      every: 3,
      unit: "week",
    });
  });

  /* Obligations stored before intervals existed carry only a cadence, and they
     have to keep working rather than silently change what they repeat on. */
  it("reads a cadence stored before intervals existed", () => {
    expect(resolveInterval({ cadence: "weekly" })).toEqual({ every: 1, unit: "week" });
    expect(resolveInterval({ cadence: "monthly" })).toEqual({ every: 1, unit: "month" });
  });

  it("treats the old custom cadence as monthly, since it carried nothing else", () => {
    expect(resolveInterval({ cadence: "custom" })).toEqual({ every: 1, unit: "month" });
  });
});

describe("describeInterval", () => {
  it("says the plain ones plainly", () => {
    expect(describeInterval({ every: 1, unit: "week" })).toBe("every week");
    expect(describeInterval({ every: 1, unit: "month" })).toBe("every month");
    expect(describeInterval({ every: 1, unit: "year" })).toBe("every year");
  });

  it("says the ones cadence could never say", () => {
    expect(describeInterval({ every: 2, unit: "week" })).toBe("every 2 weeks");
    expect(describeInterval({ every: 3, unit: "month" })).toBe("every 3 months");
    expect(describeInterval({ every: 2, unit: "year" })).toBe("every 2 years");
  });
});

describe("occurrencesInPeriod, by month", () => {
  const startsOn = "2026-01-15";

  it("falls due in the month it starts", () => {
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2026-01" })).toBe(1);
  });

  it("skips the months in between", () => {
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2026-02" })).toBe(0);
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2026-03" })).toBe(0);
  });

  it("comes round again on the interval", () => {
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2026-04" })).toBe(1);
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2026-07" })).toBe(1);
  });

  it("counts across a year boundary", () => {
    expect(occurrencesInPeriod({ interval: { every: 3, unit: "month" }, startsOn, period: "2027-01" })).toBe(1);
  });

  it("is not due before it starts", () => {
    expect(occurrencesInPeriod({ interval: { every: 1, unit: "month" }, startsOn, period: "2025-12" })).toBe(0);
  });
});

describe("occurrencesInPeriod, by year", () => {
  it("comes round every twelve months", () => {
    const interval = { every: 1, unit: "year" as const };
    const startsOn = "2026-03-01";

    expect(occurrencesInPeriod({ interval, startsOn, period: "2026-03" })).toBe(1);
    expect(occurrencesInPeriod({ interval, startsOn, period: "2026-09" })).toBe(0);
    expect(occurrencesInPeriod({ interval, startsOn, period: "2027-03" })).toBe(1);
  });

  it("counts two years as two years", () => {
    const interval = { every: 2, unit: "year" as const };
    const startsOn = "2026-03-01";

    expect(occurrencesInPeriod({ interval, startsOn, period: "2027-03" })).toBe(0);
    expect(occurrencesInPeriod({ interval, startsOn, period: "2028-03" })).toBe(1);
  });
});

describe("occurrencesInPeriod, by week", () => {
  /* The engine reasons in months, so a weekly bill is not in some months and
     not others. It is in every month, two or three times, and a month that
     counts it once is a month short of money. */
  it("counts every falling due inside the month", () => {
    const interval = { every: 1, unit: "week" as const };

    expect(occurrencesInPeriod({ interval, startsOn: "2026-01-01", period: "2026-01" })).toBe(5);
    expect(occurrencesInPeriod({ interval, startsOn: "2026-01-01", period: "2026-02" })).toBe(4);
  });

  it("counts a fortnightly bill twice in a month, not once", () => {
    expect(
      occurrencesInPeriod({
        interval: { every: 2, unit: "week" },
        startsOn: "2026-01-01",
        period: "2026-01",
      }),
    ).toBe(3);
  });

  it("does not count before it starts", () => {
    expect(
      occurrencesInPeriod({
        interval: { every: 1, unit: "week" },
        startsOn: "2026-02-10",
        period: "2026-01",
      }),
    ).toBe(0);
  });
});

describe("fallsDueInPeriod", () => {
  it("is true exactly when something falls due", () => {
    const interval = { every: 2, unit: "month" as const };

    expect(fallsDueInPeriod({ interval, startsOn: "2026-01-10", period: "2026-01" })).toBe(true);
    expect(fallsDueInPeriod({ interval, startsOn: "2026-01-10", period: "2026-02" })).toBe(false);
    expect(fallsDueInPeriod({ interval, startsOn: "2026-01-10", period: "2026-03" })).toBe(true);
  });
});
