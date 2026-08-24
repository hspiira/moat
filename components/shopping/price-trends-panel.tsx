"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { buildPriceTrends, summariseBasket } from "@/lib/domain/price-trends";
import type { Item, PriceObservation } from "@/lib/types";

export function PriceTrendsPanel({
  observations,
  items,
}: {
  observations: PriceObservation[];
  items: Item[];
}) {
  const basket = summariseBasket(buildPriceTrends({ observations, items }));

  if (basket.trends.length === 0) {
    return (
      <EmptyState className="py-6">
        <span className="grid gap-2 text-left">
          <span>
            Nothing to compare yet. Buy the same item twice with a quantity on it and this
            works out whether the price moved or you simply bought more.
          </span>
        </span>
      </EmptyState>
    );
  }

  const average = basket.averageChangePercent ?? 0;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Across {basket.trends.length} item{basket.trends.length === 1 ? "" : "s"} you buy
        repeatedly, prices are{" "}
        <span className={average > 0 ? "text-neg" : "text-pos"}>
          {average > 0 ? "up" : "down"} {Math.abs(average)}%
        </span>{" "}
        on average. {basket.dearer} dearer, {basket.cheaper} cheaper.
      </p>

      <ul className="grid gap-2">
        {basket.trends.map((trend) => (
          <li
            key={trend.itemId}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-foreground">{trend.itemName}</span>
              <span className="block text-xs text-muted-foreground">
                {formatMoney(trend.first.pricePerUnit)}
                {trend.unit ? `/${trend.unit}` : ""} in {formatDate(trend.first.occurredOn)}
                {" to "}
                {formatMoney(trend.latest.pricePerUnit)}
                {trend.unit ? `/${trend.unit}` : ""} in {formatDate(trend.latest.occurredOn)}
              </span>
            </span>

            <span
              className={`shrink-0 text-sm font-medium ${
                trend.changePercent > 0 ? "text-neg" : "text-pos"
              }`}
            >
              {trend.changePercent > 0 ? "+" : ""}
              {trend.changePercent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
