"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Item, PlannedPurchase } from "@/lib/types";

export type PlannerEditPatch = {
  quantity?: number;
  estimatedUnitPrice?: number;
  expectedTotal?: number;
  neededBy?: string;
  note?: string;
};

export function PlannerEditSheet({
  purchase,
  item,
  isSubmitting,
  onSave,
  onOpenChange,
}: {
  purchase: PlannedPurchase | null;
  item: Item | undefined;
  isSubmitting: boolean;
  onSave: (purchase: PlannedPurchase, patch: PlannerEditPatch) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={purchase !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="sr-only">
          <SheetTitle>Edit {item?.name ?? "item"}</SheetTitle>
          <SheetDescription>
            Change what you plan to buy. The item itself stays the same, so its price
            history follows it.
          </SheetDescription>
        </SheetHeader>

        {purchase ? (
          <FormCardShell
            embedded
            title={`Edit ${item?.name ?? "item"}`}
            description="Change what you plan to buy. The item itself stays the same, so its price history follows it."
          >
            <PlannerEditForm
              key={purchase.id}
              purchase={purchase}
              isSubmitting={isSubmitting}
              onSave={onSave}
            />
          </FormCardShell>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PlannerEditForm({
  purchase,
  isSubmitting,
  onSave,
}: {
  purchase: PlannedPurchase;
  isSubmitting: boolean;
  onSave: (purchase: PlannedPurchase, patch: PlannerEditPatch) => void;
}) {
  const [draft, setDraft] = useState({
    quantity: purchase.quantity != null ? String(purchase.quantity) : "",
    estimatedUnitPrice:
      purchase.estimatedUnitPrice != null ? String(purchase.estimatedUnitPrice) : "",
    expectedTotal: purchase.expectedTotal != null ? String(purchase.expectedTotal) : "",
    neededBy: purchase.neededBy ?? "",
    note: purchase.note ?? "",
  });

  const save = () =>
    onSave(purchase, {
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      estimatedUnitPrice: parseAmountInput(draft.estimatedUnitPrice) ?? undefined,
      expectedTotal: parseAmountInput(draft.expectedTotal) ?? undefined,
      neededBy: draft.neededBy || undefined,
      note: draft.note.trim() || undefined,
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <Label htmlFor="planner-edit-quantity">Quantity</Label>
        <Input
          id="planner-edit-quantity"
          inputMode="decimal"
          value={draft.quantity}
          onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-edit-estimate">Estimated price each (UGX)</Label>
        <Input
          id="planner-edit-estimate"
          inputMode="decimal"
          value={draft.estimatedUnitPrice}
          onChange={(event) =>
            setDraft({ ...draft, estimatedUnitPrice: event.target.value })
          }
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-edit-needed-by">Needed by</Label>
        <DatePicker
          id="planner-edit-needed-by"
          value={draft.neededBy}
          onChange={(neededBy) => setDraft({ ...draft, neededBy })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="planner-edit-expected-total">
          Full price if paying in instalments (UGX)
        </Label>
        <Input
          id="planner-edit-expected-total"
          inputMode="numeric"
          value={draft.expectedTotal}
          placeholder="Leave blank if paying at once"
          onChange={(event) => setDraft({ ...draft, expectedTotal: event.target.value })}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="planner-edit-note">Note (optional)</Label>
        <Input
          id="planner-edit-note"
          value={draft.note}
          placeholder="Brand, size, or where to buy it"
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </div>

      <Button size="lg" disabled={isSubmitting} onClick={save}>
        Save changes
      </Button>
    </div>
  );
}
