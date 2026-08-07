"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/format-date";
import type { Item, ItemPriceSummary, PlannedPurchase } from "@/lib/types";
import type { PlannerGroups } from "@/lib/domain/planned-purchases";

function priceMemoryLine(summary: ItemPriceSummary | undefined): string | null {
  if (!summary?.lastPaid) return null;
  const last = summary.lastPaid;
  const lastPrice = last.unitPrice ?? last.amount;
  const parts = [
    lastPrice != null
      ? `last ${lastPrice.toLocaleString()} @ ${last.merchant}`
      : `last bought @ ${last.merchant}`,
  ];
  const best = summary.bestRecent;
  const bestPrice = best ? (best.unitPrice ?? best.amount) : undefined;
  if (best && bestPrice != null && best.lineItemId !== last.lineItemId) {
    parts.push(`best ${bestPrice.toLocaleString()} @ ${best.merchant}`);
  }
  return parts.join(" · ");
}

function PlannerSection({
  title,
  purchases,
  itemsById,
  priceSummaries,
  selectedIds,
  onToggleSelect,
  onDrop,
  onOpenHistory,
}: {
  title: string;
  purchases: PlannedPurchase[];
  itemsById: Map<string, Item>;
  priceSummaries: Map<string, ItemPriceSummary>;
  selectedIds: Set<string>;
  onToggleSelect: (purchase: PlannedPurchase) => void;
  onDrop: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
}) {
  if (purchases.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-2">
        {purchases.map((purchase) => {
          const item = itemsById.get(purchase.itemId);
          const memory = priceMemoryLine(priceSummaries.get(purchase.itemId));
          const isSelected = selectedIds.has(purchase.id);
          return (
            <li key={purchase.id} className="flex items-start justify-between gap-3">
              <label className="flex min-w-0 items-start gap-2 text-sm">
                <Checkbox
                  className="mt-1"
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(purchase)}
                  aria-label={`Mark ${item?.name ?? "item"} as bought`}
                />
                <span className="min-w-0">
                  <span className="block truncate">
                    {item?.name ?? "Unknown item"}
                    {purchase.quantity != null ? ` × ${purchase.quantity}` : ""}
                  </span>
                  {purchase.neededBy ? (
                    <span className="block text-xs text-muted-foreground">
                      needed by {formatDate(purchase.neededBy)}
                    </span>
                  ) : null}
                  {memory ? (
                    <button
                      type="button"
                      className="block text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => onOpenHistory(purchase.itemId)}
                    >
                      {memory}
                    </button>
                  ) : null}
                </span>
              </label>
              <span className="flex shrink-0 items-center gap-2">
                {purchase.estimatedUnitPrice != null ? (
                  <Money
                    amount={(purchase.quantity ?? 1) * purchase.estimatedUnitPrice}
                    tone="neutral"
                  />
                ) : (
                  <Badge variant="outline">no estimate</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDrop(purchase)}>
                  Drop
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function PlannerList(props: {
  groups: PlannerGroups;
  itemsById: Map<string, Item>;
  priceSummaries: Map<string, ItemPriceSummary>;
  selectedIds: Set<string>;
  onToggleSelect: (purchase: PlannedPurchase) => void;
  onDrop: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
}) {
  const shared = props;
  return (
    <div className="grid gap-5">
      <PlannerSection title="Overdue" purchases={props.groups.overdue} {...shared} />
      <PlannerSection title="Upcoming" purchases={props.groups.upcoming} {...shared} />
      <PlannerSection title="Someday" purchases={props.groups.someday} {...shared} />
      {props.groups.history.length > 0 ? (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
            History ({props.groups.history.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {props.groups.history.map((purchase) => {
              const item = props.itemsById.get(purchase.itemId);
              return (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                >
                  <span className="min-w-0 truncate">{item?.name ?? "Unknown item"}</span>
                  <Badge variant="outline">
                    {purchase.status === "purchased" ? "Bought" : "Dropped"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
