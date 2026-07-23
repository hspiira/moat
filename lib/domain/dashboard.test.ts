import { describe, expect, it } from "vitest";

import { getChangePercent } from "@/lib/domain/dashboard";

describe("getChangePercent", () => {
  it("reports no change when both values are zero", () => {
    expect(getChangePercent(0, 0)).toEqual({ kind: "none", value: null });
  });

  it("reports new when there is no baseline", () => {
    expect(getChangePercent(500, 0)).toEqual({ kind: "new", value: null });
  });

  it("computes increases against a positive baseline", () => {
    expect(getChangePercent(150, 100)).toEqual({ kind: "delta", value: 50 });
  });

  it("computes decreases against a positive baseline", () => {
    expect(getChangePercent(50, 100)).toEqual({ kind: "delta", value: -50 });
  });

  it("keeps the sign aligned with the direction of change on a negative baseline", () => {
    // Saved going from -300k to -1.1M is a decrease and must not read as +266%.
    const change = getChangePercent(-1_100_000, -300_000);
    expect(change.kind).toBe("delta");
    expect(change.value).toBeCloseTo(-266.67, 1);
  });

  it("reports recovery from a negative baseline as an increase", () => {
    const change = getChangePercent(200_000, -100_000);
    expect(change.kind).toBe("delta");
    expect(change.value).toBeCloseTo(300, 5);
  });
});
