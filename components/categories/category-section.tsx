"use client";

import { IconChevronRight, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import type { CategoryGroup, CategoryUse } from "@/lib/domain/category-overview";
import { categoryKindLabels } from "@/lib/domain/transaction-classification";
import { formatDate } from "@/lib/format-date";
import type { CategoryKind } from "@/lib/types";

type Props = {
  group: CategoryGroup;
  isAdding: boolean;
  draftName: string;
  isBusy: boolean;
  onDraftChange: (value: string) => void;
  onStartAdd: (kind: CategoryKind | null) => void;
  onAdd: (kind: CategoryKind) => void;
  onOpen: (use: CategoryUse) => void;
};

export function CategorySection({
  group,
  isAdding,
  draftName,
  isBusy,
  onDraftChange,
  onStartAdd,
  onAdd,
  onOpen,
}: Props) {
  const total = group.uses.reduce((sum, use) => sum + use.total, 0);

  return (
    <section className="grid min-w-0 gap-1">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {categoryKindLabels[group.kind]}
          <span className="ml-1.5 normal-case">({group.uses.length})</span>
        </h2>
        <div className="flex items-baseline gap-3">
          {total > 0 ? (
            <Money
              amount={total}
              currency="UGX"
              className="text-xs tabular-nums text-muted-foreground"
            />
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => onStartAdd(isAdding ? null : group.kind)}
          >
            <IconPlus className="size-3.5" /> Add
          </Button>
        </div>
      </div>

      {isAdding ? (
        <form
          className="flex gap-2 px-1 pb-1"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd(group.kind);
          }}
        >
          <Input
            autoFocus
            value={draftName}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`New ${categoryKindLabels[group.kind].toLowerCase()} category`}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={isBusy || !draftName.trim()}>
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onStartAdd(null)}>
            Cancel
          </Button>
        </form>
      ) : null}

      <ul className="grid min-w-0 overflow-hidden rounded-lg border border-border/50">
        {group.uses.map((use) => (
          <li key={use.category.id} className="border-b border-border/40 last:border-b-0">
            <button
              type="button"
              onClick={() => onOpen(use)}
              className="flex w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span
                  className={`truncate text-sm ${use.category.isArchived ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {use.category.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {use.count === 0
                    ? "Nothing filed here"
                    : `${use.count} ${use.count === 1 ? "transaction" : "transactions"}${use.lastUsedOn ? ` · last ${formatDate(use.lastUsedOn)}` : ""}`}
                  {use.category.isArchived ? " · hidden" : ""}
                </span>
              </span>

              {use.total > 0 ? (
                <Money amount={use.total} currency="UGX" className="shrink-0 text-sm tabular-nums" />
              ) : null}

              <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
