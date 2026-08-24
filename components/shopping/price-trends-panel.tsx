"use client";

import { formatMoney } from "@/lib/currency";
import { buildPriceTrends, summariseBasket } from "@/lib/domain/price-trends";
import type { Item, PriceObservation } from "@/lib/types";

/**
 * How prices have moved on things bought more than once. Reference rather than
 * a task, so it stays folded away and says nothing at all until it can.
 */
export function PriceTrendsPanel({
  observations,
  items,
}: {
  observations: PriceObservation[];
  items: Item[];
}) {
  const basket = summariseBasket(buildPriceTrends({ observations, items }));

  if (basket.trends.length === 0) return null;

  const average = basket.averageChangePercent ?? 0;

  return (
    <details className="group border-t border-border/60 pt-3">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">What prices are doing</span>
        <span className={average > 0 ? "text-neg" : "text-pos"}>
          {average > 0 ? "up" : "down"} {Math.abs(average)}% across {basket.trends.length}
        </span>
      </summary>

      <ul className="mt-2 grid gap-0.5">
        {basket.trends.map((trend) => (
          <li
            key={trend.itemId}
            className="flex items-baseline justify-between gap-3 py-1 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-foreground">{trend.itemName}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatMoney(trend.first.pricePerUnit)} to{" "}
              {formatMoney(trend.latest.pricePerUnit)}
              {trend.unit ? `/${trend.unit}` : ""}
            </span>
            <span
              className={`w-12 shrink-0 text-right text-sm tabular-nums ${
                trend.changePercent > 0 ? "text-neg" : "text-pos"
              }`}
            >
              {trend.changePercent > 0 ? "+" : ""}
              {trend.changePercent}%
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
