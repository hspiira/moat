"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { IconCircleCheck, IconPencil, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";

import type {
  Item,
  ItemPriceSummary,
  PlannedPurchase,
  Transaction,
  TransactionLineItem,
} from "@/lib/types";
import type { PlannerGroups } from "@/lib/domain/planned-purchases";
import { buildShoppingHistory } from "@/lib/domain/shopping-history";
import { isInstallmentPurchase, summariseInstallments } from "@/lib/domain/installments";

function priceMemoryLine(summary: ItemPriceSummary | undefined): string | null {
  if (!summary?.lastPaid) return null;
  const last = summary.lastPaid;
  const lastPrice = last.unitPrice ?? last.amount;
  const parts = [
    lastPrice != null
      ? `last ${formatMoney(lastPrice)} @ ${last.merchant}`
      : `last bought @ ${last.merchant}`,
  ];
  const best = summary.bestRecent;
  const bestPrice = best ? (best.unitPrice ?? best.amount) : undefined;
  if (best && bestPrice != null && best.lineItemId !== last.lineItemId) {
    parts.push(`best ${formatMoney(bestPrice)} @ ${best.merchant}`);
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
  onEdit,
  onOpenHistory,
  lineItemsById,
}: {
  title: string;
  purchases: PlannedPurchase[];
  itemsById: Map<string, Item>;
  priceSummaries: Map<string, ItemPriceSummary>;
  selectedIds: Set<string>;
  onToggleSelect: (purchase: PlannedPurchase) => void;
  onDrop: (purchase: PlannedPurchase) => void;
  onEdit: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
  lineItemsById: Map<string, TransactionLineItem>;
}) {
  if (purchases.length === 0) return null;
  const lineItems = [...lineItemsById.values()];
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-0.5">
        {purchases.map((purchase) => {
          const item = itemsById.get(purchase.itemId);
          const memory = priceMemoryLine(priceSummaries.get(purchase.itemId));
          const plan = isInstallmentPurchase(purchase)
            ? summariseInstallments(purchase, lineItems)
            : undefined;
          const isSelected = selectedIds.has(purchase.id);
          const estimate =
            purchase.estimatedUnitPrice != null
              ? (purchase.quantity ?? 1) * purchase.estimatedUnitPrice
              : undefined;
          // One line of context, not four. The rest is a tap away in history.
          const meta = [
            purchase.neededBy ? `needed by ${formatDate(purchase.neededBy)}` : null,
            memory,
            purchase.note,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={purchase.id}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2 hover:bg-muted/40"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(purchase)}
                aria-label={`Mark ${item?.name ?? "item"} as bought`}
              />

              <button
                type="button"
                onClick={() => onOpenHistory(purchase.itemId)}
                className="block min-w-0 flex-1 overflow-hidden text-left"
              >
                <span className="block truncate text-sm text-foreground">
                  {item?.name ?? "Unknown item"}
                  {purchase.quantity != null ? (
                    <span className="text-muted-foreground"> × {purchase.quantity}</span>
                  ) : null}
                </span>
                {meta ? (
                  <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                ) : null}
                {plan && plan.expected > 0 ? (
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-1 w-16 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${plan.percentPaid}%` }}
                      />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {plan.remaining > 0
                        ? `${formatMoney(plan.remaining)} to go`
                        : "settled"}
                    </span>
                  </span>
                ) : null}
              </button>

              <span className="shrink-0 whitespace-nowrap text-right text-sm tabular-nums">
                {estimate != null ? (
                  <Money amount={estimate} tone="neutral" />
                ) : (
                  <span className="text-xs text-muted-foreground">no estimate</span>
                )}
              </span>

              <span className="flex shrink-0 items-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Edit ${item?.name ?? "item"}`}
                  onClick={() => onEdit(purchase)}
                >
                  <IconPencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Drop ${item?.name ?? "item"}`}
                  onClick={() => onDrop(purchase)}
                >
                  <IconX className="size-4" />
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
  onEdit: (purchase: PlannedPurchase) => void;
  onRestore: (purchase: PlannedPurchase) => void;
  onOpenHistory: (itemId: string) => void;
  transactionsById: Map<string, Transaction>;
  lineItemsById: Map<string, TransactionLineItem>;
  isSubmitting: boolean;
}) {
  const shared = props;
  const history = buildShoppingHistory({
    purchases: props.groups.history,
    itemsById: props.itemsById,
    transactionsById: props.transactionsById,
    lineItemsById: props.lineItemsById,
  });
  const isEmpty =
    props.groups.overdue.length === 0 &&
    props.groups.upcoming.length === 0 &&
    props.groups.someday.length === 0 &&
    props.groups.history.length === 0;

  if (isEmpty) {
    return (
      <EmptyState className="py-8">
        <span className="grid gap-2 text-left">
          <span>
            Nothing planned yet. Add what you mean to buy and this page remembers what it cost
            you last time, so you can tell a fair price from a bad one.
          </span>
          <span>Tick an item off when you buy it and it becomes an expense.</span>
        </span>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      <PlannerSection title="Overdue" purchases={props.groups.overdue} {...shared} />
      <PlannerSection title="Upcoming" purchases={props.groups.upcoming} {...shared} />
      <PlannerSection title="Someday" purchases={props.groups.someday} {...shared} />
      {history.trips.length > 0 ? (
        <section className="grid gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bought
          </h3>
          <ul className="grid gap-0.5">
            {history.trips.flatMap((trip) =>
              trip.entries.map((entry) => (
                <li
                  key={entry.purchase.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2"
                >
                  <IconCircleCheck aria-hidden className="size-4 shrink-0 text-pos" />
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-sm text-muted-foreground line-through">
                      {entry.item?.name ?? "Unknown item"}
                      {entry.quantity != null ? ` \u00d7 ${entry.quantity}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDate(trip.occurredOn)}
                      {entry.pricePerUnit != null && entry.item?.unit
                        ? ` \u00b7 ${formatMoney(entry.pricePerUnit)}/${entry.item.unit}`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground">
                    {entry.outcome.actual != null ? formatMoney(entry.outcome.actual) : "-"}
                  </span>
                </li>
              )),
            )}
          </ul>
        </section>
      ) : null}

      {history.dropped.length > 0 ? (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Dropped ({history.dropped.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {history.dropped.map(({ purchase, item }) => (
              <li
                key={purchase.id}
                className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
              >
                <span className="min-w-0 flex-1 truncate">{item?.name ?? "Unknown item"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={props.isSubmitting}
                  onClick={() => props.onRestore(purchase)}
                >
                  Put back
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
