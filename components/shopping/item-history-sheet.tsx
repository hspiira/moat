"use client";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format-date";
import type { Item, ItemPriceSummary, PriceObservation } from "@/lib/types";

export function ItemHistorySheet({
  item,
  observations,
  summary,
  onOpenChange,
}: {
  item: Item | null;
  observations: PriceObservation[];
  summary: ItemPriceSummary | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = [...observations].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const bestId = summary?.bestRecent?.lineItemId;

  return (
    <Sheet open={item != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{item?.name ?? "Item"}</SheetTitle>
          <SheetDescription>
            What you have paid for this, most recent first. The best price in the
            last 12 months is marked.
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No purchases recorded yet. Itemize a transaction that included this
              item to start its history.
            </p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((observation) => {
                const price = observation.unitPrice ?? observation.amount;
                return (
                  <li
                    key={observation.lineItemId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {formatDate(observation.occurredOn)} · {observation.merchant}
                      {observation.quantity != null ? (
                        <span className="text-muted-foreground"> × {observation.quantity}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {observation.lineItemId === bestId ? (
                        <Badge variant="outline">best price</Badge>
                      ) : null}
                      {price != null ? (
                        <Money amount={price} tone="neutral" />
                      ) : (
                        <span className="text-xs text-muted-foreground">no amount</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
