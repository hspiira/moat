"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Item } from "@/lib/types";

const emptyDraft = { name: "", quantity: "", estimatedUnitPrice: "", neededBy: "", note: "" };

export function PlannerAddForm({
  items,
  isSubmitting,
  onAdd,
}: {
  items: Item[];
  isSubmitting: boolean;
  onAdd: (input: {
    name: string;
    quantity?: number;
    estimatedUnitPrice?: number;
    neededBy?: string;
    note?: string;
  }) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);

  const submit = () => {
    if (!draft.name.trim()) return;
    onAdd({
      name: draft.name,
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      estimatedUnitPrice: parseAmountInput(draft.estimatedUnitPrice) ?? undefined,
      neededBy: draft.neededBy || undefined,
      note: draft.note.trim() || undefined,
    });
    setDraft(emptyDraft);
  };

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="planner-name">Item</Label>
        <Input
          id="planner-name"
          list="planner-item-suggestions"
          value={draft.name}
          placeholder="Sugar (1kg)"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <datalist id="planner-item-suggestions">
          {items
            .filter((item) => !item.isArchived)
            .map((item) => (
              <option key={item.id} value={item.name} />
            ))}
        </datalist>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-quantity">Qty</Label>
        <Input
          id="planner-quantity"
          inputMode="numeric"
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-estimate">Est. price</Label>
        <Input
          id="planner-estimate"
          inputMode="numeric"
          value={draft.estimatedUnitPrice}
          onChange={(event) => setDraft({ ...draft, estimatedUnitPrice: event.target.value })}
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
        <Button disabled={isSubmitting || !draft.name.trim()} onClick={submit}>
          Add to list
        </Button>
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
  );
}
