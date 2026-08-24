import { describe, expect, it } from "vitest";

import { buildPriceTrends, summariseBasket } from "@/lib/domain/price-trends";
import type { Item, PriceObservation } from "@/lib/types";

function item(id: string, name: string, unit?: string, isArchived = false): Item {
  return {
    id,
    userId: "u1",
    name,
    normalizedName: name.toLowerCase(),
    unit,
    isArchived,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

function seen(
  itemId: string,
  occurredOn: string,
  over: Partial<PriceObservation> = {},
): PriceObservation {
  return {
    itemId,
    transactionId: `t:${itemId}:${occurredOn}`,
    lineItemId: `l:${itemId}:${occurredOn}`,
    merchant: "Market",
    occurredOn,
    ...over,
  } as PriceObservation;
}

const sugar = item("i1", "Sugar", "kg");

describe("buildPriceTrends", () => {
  it("measures the move from the first reading to the latest", () => {
    const trends = buildPriceTrends({
      items: [sugar],
      observations: [
        seen("i1", "2026-03-01", { unitPrice: 4_000 }),
        seen("i1", "2026-08-01", { unitPrice: 4_720 }),
      ],
    });

    expect(trends).toHaveLength(1);
    expect(trends[0]).toMatchObject({
      itemName: "Sugar",
      unit: "kg",
      changeAmount: 720,
      changePercent: 18,
    });
  });

  it("works the unit price out of a total when it has to", () => {
    const trends = buildPriceTrends({
      items: [sugar],
      observations: [
        seen("i1", "2026-03-01", { amount: 8_000, quantity: 2 }),
        seen("i1", "2026-08-01", { amount: 15_000, quantity: 3 }),
      ],
    });

    expect(trends[0]).toMatchObject({ changePercent: 25 });
  });

  it("leaves out anything it cannot price per unit, rather than guessing", () => {
    const trends = buildPriceTrends({
      items: [sugar],
      observations: [
        seen("i1", "2026-03-01", { amount: 8_000 }),
        seen("i1", "2026-08-01", { amount: 9_000 }),
      ],
    });

    expect(trends).toEqual([]);
  });

  it("needs two different days, since one shop is not a trend", () => {
    const sameDay = buildPriceTrends({
      items: [sugar],
      observations: [
        seen("i1", "2026-08-01", { unitPrice: 4_000 }),
        seen("i1", "2026-08-01", { unitPrice: 5_000 }),
      ],
    });
    const onlyOnce = buildPriceTrends({
      items: [sugar],
      observations: [seen("i1", "2026-08-01", { unitPrice: 4_000 })],
    });

    expect(sameDay).toEqual([]);
    expect(onlyOnce).toEqual([]);
  });

  it("ignores an item that has been retired", () => {
    const trends = buildPriceTrends({
      items: [item("i1", "Sugar", "kg", true)],
      observations: [
        seen("i1", "2026-03-01", { unitPrice: 4_000 }),
        seen("i1", "2026-08-01", { unitPrice: 5_000 }),
      ],
    });

    expect(trends).toEqual([]);
  });

  it("puts the sharpest rise first, which is the one worth acting on", () => {
    const trends = buildPriceTrends({
      items: [sugar, item("i2", "Rice", "kg")],
      observations: [
        seen("i1", "2026-03-01", { unitPrice: 4_000 }),
        seen("i1", "2026-08-01", { unitPrice: 4_400 }),
        seen("i2", "2026-03-01", { unitPrice: 3_000 }),
        seen("i2", "2026-08-01", { unitPrice: 4_500 }),
      ],
    });

    expect(trends.map((trend) => trend.itemName)).toEqual(["Rice", "Sugar"]);
  });

  it("reports a fall as a fall", () => {
    const trends = buildPriceTrends({
      items: [sugar],
      observations: [
        seen("i1", "2026-03-01", { unitPrice: 5_000 }),
        seen("i1", "2026-08-01", { unitPrice: 4_000 }),
      ],
    });

    expect(trends[0].changePercent).toBe(-20);
  });
});

describe("summariseBasket", () => {
  const trends = buildPriceTrends({
    items: [sugar, item("i2", "Rice", "kg"), item("i3", "Salt", "kg")],
    observations: [
      seen("i1", "2026-03-01", { unitPrice: 4_000 }),
      seen("i1", "2026-08-01", { unitPrice: 4_800 }),
      seen("i2", "2026-03-01", { unitPrice: 3_000 }),
      seen("i2", "2026-08-01", { unitPrice: 2_700 }),
      // A one percent wobble is not a price change.
      seen("i3", "2026-03-01", { unitPrice: 1_000 }),
      seen("i3", "2026-08-01", { unitPrice: 1_010 }),
    ],
  });

  it("counts what got dearer and what got cheaper", () => {
    expect(summariseBasket(trends)).toMatchObject({ dearer: 1, cheaper: 1 });
  });

  it("drops movements too small to mean anything", () => {
    expect(summariseBasket(trends).trends.map((t) => t.itemName)).not.toContain("Salt");
  });

  it("averages only what it kept", () => {
    // Sugar +20, rice -10.
    expect(summariseBasket(trends).averageChangePercent).toBe(5);
  });

  it("says nothing rather than zero when there is nothing to say", () => {
    expect(summariseBasket([]).averageChangePercent).toBeUndefined();
  });
});
