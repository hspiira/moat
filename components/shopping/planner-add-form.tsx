"use client";

import { useState } from "react";

import { IconChevronDown } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneyShort } from "@/lib/currency";
import { normalizeItemName } from "@/lib/domain/item-normalization";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Item } from "@/lib/types";

// What a shop here actually sells things by, so the unit is a tap not a guess.
const UNIT_SUGGESTIONS = ["kg", "g", "litre", "ml", "piece", "packet", "bunch", "tray", "bar"];

const emptyDraft = {
  name: "",
  quantity: "",
  unit: "",
  estimatedUnitPrice: "",
  expectedTotal: "",
  neededBy: "",
  note: "",
};

export type PlannerAddInput = {
  name: string;
  unit?: string;
  quantity?: number;
  estimatedUnitPrice?: number;
  expectedTotal?: number;
  neededBy?: string;
  note?: string;
};

export function PlannerAddForm({
  items,
  lastPaidFor,
  isSubmitting,
  onAdd,
}: {
  items: Item[];
  lastPaidFor?: (itemId: string) => number | undefined;
  isSubmitting: boolean;
  onAdd: (input: PlannerAddInput) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [showDetails, setShowDetails] = useState(false);

  const matchedItem = items.find(
    (item) => !item.isArchived && normalizeItemName(item.name) === normalizeItemName(draft.name),
  );
  const remembered = matchedItem ? lastPaidFor?.(matchedItem.id) : undefined;

  function submit() {
    if (!draft.name.trim()) return;
    onAdd({
      name: draft.name,
      unit: draft.unit.trim() || undefined,
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      estimatedUnitPrice: parseAmountInput(draft.estimatedUnitPrice) ?? undefined,
      expectedTotal: parseAmountInput(draft.expectedTotal) ?? undefined,
      neededBy: draft.neededBy || undefined,
      note: draft.note.trim() || undefined,
    });
    setDraft(emptyDraft);
    setShowDetails(false);
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="planner-name">Item</Label>
        <Input
          id="planner-name"
          list="planner-item-suggestions"
          value={draft.name}
          placeholder="Sugar"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <datalist id="planner-item-suggestions">
          {items
            .filter((item) => !item.isArchived)
            .map((item) => (
              <option key={item.id} value={item.name} />
            ))}
        </datalist>
        {remembered != null && !draft.estimatedUnitPrice ? (
          <p className="text-xs text-muted-foreground">
            You last paid {formatMoneyShort(remembered)}. Leave the price out to use that.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        aria-expanded={showDetails}
        onClick={() => setShowDetails((open) => !open)}
        className="flex w-full items-center justify-between border-y border-border/60 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <span>Quantity, price and date</span>
        <IconChevronDown
          className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
        />
      </button>

      {showDetails ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="planner-quantity">Quantity</Label>
              <Input
                id="planner-quantity"
                inputMode="numeric"
                value={draft.quantity}
                placeholder="1"
                onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="planner-unit">Unit</Label>
              <Input
                id="planner-unit"
                list="planner-unit-suggestions"
                value={draft.unit}
                placeholder={matchedItem?.unit ?? "kg"}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              />
              <datalist id="planner-unit-suggestions">
                {UNIT_SUGGESTIONS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="planner-estimate">Estimated price each (UGX)</Label>
            <Input
              id="planner-estimate"
              inputMode="numeric"
              value={draft.estimatedUnitPrice}
              placeholder={remembered != null ? String(remembered) : undefined}
              onChange={(event) =>
                setDraft({ ...draft, estimatedUnitPrice: event.target.value })
              }
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="planner-needed-by">Needed by</Label>
            <DatePicker
              id="planner-needed-by"
              value={draft.neededBy}
              onChange={(value) => setDraft({ ...draft, neededBy: value })}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="planner-expected-total">Full price if paying in instalments (UGX)</Label>
            <Input
              id="planner-expected-total"
              inputMode="numeric"
              value={draft.expectedTotal}
              placeholder="Leave blank if paying at once"
              onChange={(event) => setDraft({ ...draft, expectedTotal: event.target.value })}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="planner-note">Note (optional)</Label>
            <Input
              id="planner-note"
              value={draft.note}
              placeholder="Brand, size, or where to buy it"
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={isSubmitting || !draft.name.trim()} className="w-full">
        Add to list
      </Button>
    </form>
  );
}
