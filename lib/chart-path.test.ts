import { describe, expect, it } from "vitest";

import { smoothAreaPath, smoothLinePath, type ChartPoint } from "@/lib/chart-path";

function yValues(path: string): number[] {
  return [...path.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1]),
  );
}

const rising: ChartPoint[] = [
  { x: 0, y: 100 },
  { x: 25, y: 80 },
  { x: 50, y: 60 },
  { x: 75, y: 40 },
  { x: 100, y: 20 },
];

describe("smoothLinePath", () => {
  it("starts at the first point and ends at the last", () => {
    const path = smoothLinePath(rising);

    expect(path.startsWith("M 0,100")).toBe(true);
    expect(path.endsWith("100.000,20.00")).toBe(true);
  });

  it("draws a curve for every gap between points", () => {
    expect(smoothLinePath(rising).match(/C /g)).toHaveLength(rising.length - 1);
  });

  it("never leaves the range of the data it is drawing", () => {
    // A spike is where a plain Catmull-Rom curve overshoots, drawing a dip to a
    // balance that never happened.
    const spike: ChartPoint[] = [
      { x: 0, y: 100 },
      { x: 25, y: 100 },
      { x: 50, y: 10 },
      { x: 75, y: 100 },
      { x: 100, y: 100 },
    ];
    const values = yValues(smoothLinePath(spike));

    expect(Math.min(...values)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
  });

  it("handles two points", () => {
    const path = smoothLinePath([
      { x: 0, y: 50 },
      { x: 100, y: 10 },
    ]);

    expect(path.startsWith("M 0,50")).toBe(true);
    expect(path).toContain("C ");
  });

  it("has nothing to draw for a single point or none", () => {
    expect(smoothLinePath([{ x: 0, y: 1 }])).toBe("M 0,1");
    expect(smoothLinePath([])).toBe("");
  });
});

describe("smoothAreaPath", () => {
  it("closes the curve down to the baseline", () => {
    const path = smoothAreaPath(rising, 160);

    expect(path).toContain("L 100,160");
    expect(path).toContain("L 0,160");
    expect(path.endsWith("Z")).toBe(true);
  });

  it("has nothing to fill with fewer than two points", () => {
    expect(smoothAreaPath([{ x: 0, y: 1 }], 160)).toBe("");
  });
});
