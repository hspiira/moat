"use client";

import { IconX } from "@tabler/icons-react";

import type { RuleDraft } from "@/lib/domain/rule-from-correction";
import { Button } from "@/components/ui/button";

export function RuleOfferBanner({
  offer,
  categoryName,
  isSubmitting,
  onAccept,
  onDismiss,
}: {
  offer: RuleDraft | null;
  categoryName: string | null;
  isSubmitting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (!offer) return null;

  const changes = [
    offer.effectPayee ? `call it ${offer.effectPayee}` : null,
    categoryName ? `file it under ${categoryName}` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-2 border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-6 text-foreground">
          You fixed that one by hand. Next time a message says{" "}
          <span className="font-medium">{offer.payeePattern}</span>, should Moat{" "}
          {changes.join(" and ")}?
        </p>
        <button
          type="button"
          aria-label="Not now"
          className="-mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={onDismiss}
        >
          <IconX className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        It fills in the details. You still check every message before it counts.
      </p>
      <Button
        type="button"
        size="sm"
        className="justify-self-start"
        disabled={isSubmitting}
        onClick={onAccept}
      >
        Yes, do this for me
      </Button>
    </div>
  );
}
