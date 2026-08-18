"use client";

import { IconCopyCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryDuplicateGroup } from "@/lib/domain/category-merge";

export function DuplicatesCard({
  duplicates,
  isBusy,
  onMerge,
}: {
  duplicates: CategoryDuplicateGroup[];
  isBusy: boolean;
  onMerge: () => void;
}) {
  const extras = duplicates.reduce((sum, group) => sum + group.duplicates.length, 0);

  return (
    <Card className="border-primary/30 bg-primary/5 py-0 shadow-none">
      <CardContent className="grid gap-3 px-4 py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
          >
            <IconCopyCheck className="size-4.5" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              {extras} duplicate {extras === 1 ? "category" : "categories"}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {duplicates
                .map((group) => group.survivor.name)
                .slice(0, 6)
                .join(", ")}
              {duplicates.length > 6 ? ` and ${duplicates.length - 6} more` : ""} appear more than
              once. Merging moves everything into the copy already in use and clears the rest.
            </p>
          </div>
        </div>
        <Button size="sm" className="justify-self-start" disabled={isBusy} onClick={onMerge}>
          Merge duplicates
        </Button>
      </CardContent>
    </Card>
  );
}
