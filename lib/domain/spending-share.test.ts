import { describe, expect, it } from "vitest";

import {
  REMAINDER_LABEL,
  buildSpendingShare,
  type SpendingCategory,
} from "@/lib/domain/spending-share";

const category = (name: string, amount: number, count = 1): SpendingCategory => ({
  categoryId: `category:${name}`,
  categoryName: name,
  amount,
  count,
});

const TOP_FIVE = [
  category("Rent", 3_000_000, 2),
  category("Church / giving", 420_000, 3),
  category("Transport / boda", 306_000, 35),
  category("Food", 228_000, 10),
  category("Family support", 103_500, 3),
];

const LISTED_TOTAL = 4_057_500;

describe("buildSpendingShare", () => {
  it("measures each category against the period, not against the biggest one", () => {
    const { segments } = buildSpendingShare(TOP_FIVE, LISTED_TOTAL);

    expect(segments[0].share).toBeCloseTo(3_000_000 / LISTED_TOTAL);
    expect(segments[0].share).toBeLessThan(1);
  });

  it("accounts for spending outside the top five, so the shares do not overstate", () => {
    const { segments } = buildSpendingShare(TOP_FIVE, 5_000_000);
    const remainder = segments.at(-1)!;

    expect(remainder.label).toBe(REMAINDER_LABEL);
    expect(remainder.isRemainder).toBe(true);
    expect(remainder.amount).toBe(5_000_000 - LISTED_TOTAL);
  });

  it("adds up to the whole strip", () => {
    const { segments } = buildSpendingShare(TOP_FIVE, 5_000_000);

    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1);
  });

  it("adds no remainder when the listed categories are all of it", () => {
    const { segments } = buildSpendingShare(TOP_FIVE, LISTED_TOTAL);

    expect(segments).toHaveLength(TOP_FIVE.length);
    expect(segments.some((segment) => segment.isRemainder)).toBe(false);
  });

  it("never shows a negative remainder when the totals disagree", () => {
    const { segments, total } = buildSpendingShare(TOP_FIVE, 1_000);

    expect(total).toBe(LISTED_TOTAL);
    expect(segments.every((segment) => segment.share >= 0)).toBe(true);
    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1);
  });

  it("has nothing to draw when nothing was spent", () => {
    expect(buildSpendingShare([], 0)).toEqual({ total: 0, segments: [] });
  });

  it("keeps the count for a category and drops it for the remainder", () => {
    const { segments } = buildSpendingShare(TOP_FIVE, 5_000_000);

    expect(segments[2].count).toBe(35);
    expect(segments.at(-1)!.count).toBeNull();
  });
});
