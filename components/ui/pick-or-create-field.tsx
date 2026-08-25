"use client";

import { useMemo, useRef, useState } from "react";
import { IconCheck, IconPlus, IconSelector } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  canCreatePickOption,
  matchPickOptions,
  pickMatchKey,
} from "@/lib/domain/pick-options";
import { cn } from "@/lib/utils";

/**
 * Pick a name already in use, or add one.
 *
 * Payees, units and item groups are text on the records that carry them. Typed
 * fresh each time they drift into near-duplicates that never group together, so
 * this offers what has been used before and keeps a new name to a deliberate act.
 */
export function PickOrCreateField({
  id,
  label,
  placeholder,
  searchPlaceholder,
  emptyHint,
  options,
  value,
  onChange,
  allowClear = false,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyHint: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  allowClear?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => matchPickOptions(options, query), [options, query]);
  const trimmed = query.trim();
  const canAdd = canCreatePickOption(options, query);
  const errorId = `${id}-error`;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
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
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
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
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (matches.length > 0) choose(matches[0]);
                else if (canAdd) choose(trimmed);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-md bg-muted/50 px-3 text-base sm:text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
            {matches.length === 0 && !canAdd ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyHint}</p>
            ) : null}

            {allowClear && value ? (
              <button
                type="button"
                onClick={() => choose("")}
                className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60"
              >
                Leave blank
              </button>
            ) : null}

            {matches.map((option) => {
              const isSelected = pickMatchKey(option) === pickMatchKey(value);

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="truncate">{option}</span>
                  {isSelected ? <IconCheck className="size-4 shrink-0" /> : null}
                </button>
              );
            })}

            {canAdd ? (
              <button
                type="button"
                onClick={() => choose(trimmed)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
              >
                <IconPlus className="size-4 shrink-0 opacity-60" />
                Add “{trimmed}”
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
