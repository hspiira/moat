import type { Item, PriceObservation } from "@/lib/types";

export type PricePoint = {
  occurredOn: string;
  pricePerUnit: number;
  merchant: string;
};

export type PriceTrend = {
  itemId: string;
  itemName: string;
  unit?: string;
  first: PricePoint;
  latest: PricePoint;
  changeAmount: number;
  /** Rounded percentage. Positive means dearer than the first reading. */
  changePercent: number;
  points: PricePoint[];
};

export type BasketTrend = {
  trends: PriceTrend[];
  /** Weighted by nothing: the plain average move across items that have one. */
  averageChangePercent?: number;
  dearer: number;
  cheaper: number;
};

/** Ignores anything below this, which is noise rather than a price change. */
const MEANINGFUL_PERCENT = 3;

function pricePerUnitOf(observation: PriceObservation): number | undefined {
  if (observation.unitPrice != null && observation.unitPrice > 0) {
    return observation.unitPrice;
  }
  if (
    observation.amount != null &&
    observation.quantity != null &&
    observation.quantity > 0
  ) {
    return observation.amount / observation.quantity;
  }
  return undefined;
}

/**
 * How the price of each item has moved, from the first reading to the latest.
 * Comparing per unit is what makes two trips of different sizes comparable, so
 * anything without a usable unit price is left out rather than guessed at.
 */
export function buildPriceTrends(params: {
  observations: PriceObservation[];
  items: Item[];
  minimumObservations?: number;
}): PriceTrend[] {
  const minimum = params.minimumObservations ?? 2;
  const itemsById = new Map(params.items.map((item) => [item.id, item]));
  const byItem = new Map<string, PricePoint[]>();

  for (const observation of params.observations) {
    const pricePerUnit = pricePerUnitOf(observation);
    if (pricePerUnit == null) continue;

    const points = byItem.get(observation.itemId) ?? [];
    points.push({
      occurredOn: observation.occurredOn,
      pricePerUnit: Math.round(pricePerUnit),
      merchant: observation.merchant,
    });
    byItem.set(observation.itemId, points);
  }

  const trends: PriceTrend[] = [];

  for (const [itemId, unsorted] of byItem) {
    const item = itemsById.get(itemId);
    if (!item || item.isArchived) continue;

    const points = [...unsorted].sort((left, right) =>
      left.occurredOn.localeCompare(right.occurredOn),
    );
    if (points.length < minimum) continue;

    const first = points[0];
    const latest = points[points.length - 1];
    // Two readings from the same day say nothing about a trend.
    if (first.occurredOn === latest.occurredOn) continue;
    if (first.pricePerUnit <= 0) continue;

    const changeAmount = latest.pricePerUnit - first.pricePerUnit;
    trends.push({
      itemId,
      itemName: item.name,
      unit: item.unit,
      first,
      latest,
      changeAmount,
      changePercent: Math.round((changeAmount / first.pricePerUnit) * 100),
      points,
    });
  }

  return trends.sort((left, right) => right.changePercent - left.changePercent);
}

/** The same trends with the small movements dropped and the shape summarised. */
export function summariseBasket(trends: PriceTrend[]): BasketTrend {
  const meaningful = trends.filter(
    (trend) => Math.abs(trend.changePercent) >= MEANINGFUL_PERCENT,
  );

  return {
    trends: meaningful,
    averageChangePercent: meaningful.length
      ? Math.round(
          meaningful.reduce((total, trend) => total + trend.changePercent, 0) /
            meaningful.length,
        )
      : undefined,
    dearer: meaningful.filter((trend) => trend.changePercent > 0).length,
    cheaper: meaningful.filter((trend) => trend.changePercent < 0).length,
  };
}
