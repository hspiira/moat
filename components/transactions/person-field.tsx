"use client";

import { useMemo, useRef, useState } from "react";
import { IconCheck, IconSelector, IconUserPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  NEW_COUNTERPARTY,
  rankCounterpartiesFor,
  type TransferDirection,
} from "@/lib/domain/transfer-counterparty";
import { counterpartyMatchKey } from "@/lib/domain/counterparties";
import type { Counterparty } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PersonField({
  id = "tx-counterparty",
  label,
  placeholder,
  counterparties,
  direction,
  value,
  newName,
  subtitleFor,
  onSelect,
  onAdd,
  error,
}: {
  id?: string;
  label: string;
  placeholder: string;
  counterparties: Counterparty[];
  direction: TransferDirection;
  value: string;
  newName: string;
  subtitleFor?: (counterparty: Counterparty) => string | null;
  onSelect: (counterpartyId: string) => void;
  onAdd: (name: string) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const people = useMemo(
    () => rankCounterpartiesFor(counterparties, direction),
    [counterparties, direction],
  );

  const matches = useMemo(() => {
    const needle = counterpartyMatchKey(query);
    if (!needle) return people;
    return people.filter((person) => counterpartyMatchKey(person.name).includes(needle));
  }, [people, query]);

  const selected = people.find((person) => person.id === value);
  const trimmed = query.trim();
  const canAdd =
    trimmed.length > 0 &&
    !people.some((person) => counterpartyMatchKey(person.name) === counterpartyMatchKey(trimmed));

  const chosenLabel =
    selected?.name ?? (value === NEW_COUNTERPARTY && newName ? newName : null);
  const errorId = `${id}-error`;

  function close() {
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
            <span className={cn("truncate", !chosenLabel && "text-muted-foreground")}>
              {chosenLabel ?? placeholder}
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
              placeholder="Search or type a name"
              aria-label="Search people"
              className="h-9 w-full rounded-md bg-muted/50 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>

          <div className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
            {matches.length === 0 && !canAdd ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nobody here yet. Type a name to add them.
              </p>
            ) : null}

            {matches.map((person) => {
              const subtitle = subtitleFor?.(person);
              const isSelected = person.id === value;

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    onSelect(person.id);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate">{person.name}</span>
                    {subtitle ? (
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? <IconCheck className="size-4 shrink-0" /> : null}
                </button>
              );
            })}

            {canAdd ? (
              <button
                type="button"
                onClick={() => {
                  onAdd(trimmed);
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
              >
                <IconUserPlus className="size-4 shrink-0 opacity-60" />
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
