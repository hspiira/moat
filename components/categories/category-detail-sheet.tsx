"use client";

import { useState } from "react";
import { IconArrowsExchange2, IconTrash } from "@tabler/icons-react";

import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { categoryKindLabels } from "@/lib/domain/transaction-classification";
import type { CategoryUse } from "@/lib/domain/category-overview";
import { formatDate } from "@/lib/format-date";
import type { Category } from "@/lib/types";

type Props = {
  use: CategoryUse | null;
  categories: Category[];
  isBusy: boolean;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (category: Category, name: string) => void;
  onToggleHidden: (category: Category, hidden: boolean) => void;
  onMoveInto: (category: Category, targetId: string) => void;
  onDelete: (category: Category) => void;
};

export function CategoryDetailSheet({
  use,
  categories,
  isBusy,
  canDelete,
  onOpenChange,
  onRename,
  onToggleHidden,
  onMoveInto,
  onDelete,
}: Props) {
  const category = use?.category ?? null;
  const [name, setName] = useState(category?.name ?? "");
  const [targetId, setTargetId] = useState("");
  const [confirming, setConfirming] = useState<"move" | "delete" | null>(null);

  if (!use || !category) return null;

  const targets = categories.filter(
    (entry) => entry.kind === category.kind && entry.id !== category.id && !entry.isArchived,
  );
  const target = targets.find((entry) => entry.id === targetId);
  const moveCount = use.count;

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{category.name}</SheetTitle>
            <SheetDescription>
              {categoryKindLabels[category.kind]}
              {" · "}
              {use.count === 0
                ? "nothing filed here"
                : `${use.count} transaction${use.count === 1 ? "" : "s"}`}
              {use.lastUsedOn ? ` · last ${formatDate(use.lastUsedOn)}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6">
            {use.total > 0 ? (
              <Money
                amount={use.total}
                currency="UGX"
                className="font-display text-2xl font-semibold tabular-nums"
              />
            ) : null}

            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onRename(category, name);
              }}
            >
              <Label htmlFor="category-name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10"
                />
                <Button
                  type="submit"
                  disabled={isBusy || !name.trim() || name.trim() === category.name}
                >
                  Save
                </Button>
              </div>
            </form>

            {targets.length > 0 ? (
              <div className="grid gap-2">
                <SelectField
                  id="category-move-target"
                  label="Move everything into"
                  value={targetId}
                  placeholder="Pick a category"
                  options={targets.map((entry) => ({ value: entry.id, label: entry.name }))}
                  onValueChange={setTargetId}
                />
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  disabled={isBusy || !target}
                  onClick={() => setConfirming("move")}
                >
                  <IconArrowsExchange2 className="size-4" />
                  {target ? `Move into ${target.name}` : "Move into another category"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Every transaction, budget, rule and bill filed under {category.name} moves
                  across, and {category.name} then{" "}
                  {category.isDefault ? "gets hidden" : "goes away"}.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2 border-t border-border/40 pt-5">
              <Button
                variant="outline"
                disabled={isBusy}
                onClick={() => onToggleHidden(category, !category.isArchived)}
              >
                {category.isArchived ? "Show in the picker" : "Hide from the picker"}
              </Button>

              {canDelete ? (
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={isBusy}
                  onClick={() => setConfirming("delete")}
                >
                  <IconTrash className="size-4" />
                  Delete
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {category.isDefault
                    ? "This one comes with Moat, so deleting it would only bring it back on the next load. Hide it instead."
                    : "Something is still filed under this category. Move it somewhere else first, then it can go."}
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirming === "move"}
        onOpenChange={(open) => setConfirming(open ? "move" : null)}
        title={`Move into ${target?.name ?? ""}?`}
        description={`${moveCount} transaction${moveCount === 1 ? "" : "s"} and anything else filed under ${category.name} will point at ${target?.name ?? ""} instead. This cannot be undone in one step.`}
        confirmLabel="Move"
        busy={isBusy}
        onConfirm={() => {
          setConfirming(null);
          if (target) onMoveInto(category, target.id);
        }}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => setConfirming(open ? "delete" : null)}
        title={`Delete ${category.name}?`}
        description="Nothing is filed under it, so nothing else changes."
        confirmLabel="Delete"
        destructive
        busy={isBusy}
        onConfirm={() => {
          setConfirming(null);
          onDelete(category);
        }}
      />
    </>
  );
}
