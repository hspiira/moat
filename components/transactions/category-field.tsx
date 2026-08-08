"use client";

import { useMemo, useRef, useState } from "react";
import { IconCheck, IconSelector } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  allowedCategoryKinds,
  categoryKindLabels,
  categoryKindOrder,
} from "@/lib/domain/transaction-classification";
import { orderCategoriesForPicker } from "@/lib/domain/category-usage";
import type { Category, CategoryKind, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Category picker for transactions.
 *
 * A plain select listed all 25 categories under six headings every time, so
 * capturing an expense meant scrolling past Income, Savings, Transfers, Debt
 * and Lending to reach the fourteen that applied. Here the kinds the current
 * movement allows come first and the rest sit behind one toggle, and typing
 * filters everything — so the list stays short however many categories exist.
 */
export function CategoryField({
  id = "tx-category",
  label = "Category",
  categories,
  value,
  type,
  usage,
  onSelect,
  onCreate,
  error,
}: {
  id?: string;
  label?: string;
  categories: Category[];
  value: string;
  /** The movement in play. Its categories are offered first. */
  type: TransactionType;
  /** Transactions per categoryId. The ones you use most are listed first. */
  usage?: Map<string, number>;
  onSelect: (category: Category) => void;
  /** Omit to hide the create row, as in a review screen. */
  onCreate?: (name: string, kind: CategoryKind) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = categories.find((category) => category.id === value);
  const preferredKinds = useMemo(() => allowedCategoryKinds[type] ?? [], [type]);

  // Most used first, and hidden categories left out unless still in use.
  const ranked = useMemo(
    () => orderCategoriesForPicker(categories, usage ?? new Map()),
    [categories, usage],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? ranked.filter((category) => category.name.toLowerCase().includes(needle))
      : ranked;

    // Searching means the user knows what they want; scoping the results to
    // one movement would just hide it.
    const kinds = needle || showAll ? categoryKindOrder : preferredKinds;

    return kinds
      .map((kind) => ({
        kind,
        label: categoryKindLabels[kind],
        options: matches.filter((category) => category.kind === kind),
      }))
      .filter((group) => group.options.length > 0);
  }, [ranked, query, showAll, preferredKinds]);

  const hiddenCount = useMemo(() => {
    if (showAll || query.trim()) return 0;
    return ranked.filter((category) => !preferredKinds.includes(category.kind)).length;
  }, [ranked, showAll, query, preferredKinds]);

  // A new category takes the kind of the movement in play, so it is valid for
  // this transaction the moment it is made.
  const newCategoryKind: CategoryKind = preferredKinds[0] ?? "expense";
  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmedQuery.length > 0 &&
    !categories.some(
      (category) => category.name.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  const errorId = `${id}-error`;

  function choose(category: Category) {
    onSelect(category);
    setOpen(false);
    setQuery("");
    setShowAll(false);
  }

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setShowAll(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-10 w-full justify-between px-3 font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.name ?? "What was it for?"}
            </span>
            <IconSelector className="size-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
        >
          <div className="p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
              className="h-9 w-full rounded-md bg-muted/50 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          {/* Capped so the list can never grow past the viewport, however many
              categories a user adds. */}
          <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
            {groups.length === 0 && !canCreate ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No category matches “{query.trim()}”.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.kind} className="pb-1">
                  <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  {group.options.map((category) => {
                    const isSelected = category.id === value;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => choose(category)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-muted font-medium text-foreground"
                            : "text-foreground hover:bg-muted/60",
                        )}
                      >
                        <span className="truncate">{category.name}</span>
                        {isSelected ? <IconCheck className="size-4 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                Something else… ({hiddenCount} more)
              </button>
            ) : null}

            {/* Type a name nobody has used yet and make it here. The kind comes
                from the movement in play, so the user is never asked what a
                category "kind" is. */}
            {canCreate ? (
              <button
                type="button"
                onClick={() => {
                  onCreate?.(query.trim(), newCategoryKind);
                  setOpen(false);
                  setQuery("");
                  setShowAll(false);
                }}
                className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
              >
                Create “{query.trim()}” in {categoryKindLabels[newCategoryKind]}
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
