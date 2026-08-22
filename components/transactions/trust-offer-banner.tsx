"use client";

import { IconX } from "@tabler/icons-react";

import { ACCEPTANCES_BEFORE_TRUSTED } from "@/lib/domain/rule-trust";
import type { TransactionRule } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function TrustOfferBanner({
  rule,
  isSubmitting,
  onAccept,
  onDismiss,
}: {
  rule: TransactionRule | null;
  isSubmitting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (!rule) return null;

  const times = rule.timesAccepted ?? ACCEPTANCES_BEFORE_TRUSTED;

  return (
    <div className="grid gap-2 border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-6 text-foreground">
          <span className="font-medium">{rule.name}</span> has agreed with you {times} times
          running. Should it file these on its own from now on?
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
        They stop waiting here and go straight to your ledger. If it ever overrides a fix of
        yours, it stops doing this by itself.
      </p>
      <Button
        type="button"
        size="sm"
        className="justify-self-start"
        disabled={isSubmitting}
        onClick={onAccept}
      >
        Yes, let it file these
      </Button>
    </div>
  );
}
