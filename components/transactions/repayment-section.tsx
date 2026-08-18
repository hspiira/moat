"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency";
import type { RepaymentPreview } from "@/lib/domain/repayment";

export function RepaymentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function RepaymentSummary({
  preview,
  outstandingLabel,
  caption,
  settling,
  canPayAll,
  onPayAll,
}: {
  preview: RepaymentPreview;
  outstandingLabel: string;
  caption?: string | null;
  settling: boolean;
  canPayAll: boolean;
  onPayAll: () => void;
}) {
  const { outstanding, payoffAmount, remaining, clears, split } = preview;

  if (outstanding <= 0 && !settling) {
    return null;
  }

  return (
    <div className="grid gap-2 text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-muted-foreground">
          {outstandingLabel}{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(outstanding, "UGX")}
          </span>
          {caption ? <span className="text-muted-foreground"> · {caption}</span> : null}
        </span>

        {canPayAll && payoffAmount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={onPayAll}
          >
            Pay it all
          </Button>
        ) : null}
      </div>

      {split && split.interest > 0 ? (
        <p className="text-muted-foreground">
          <span className="tabular-nums text-foreground">
            {formatMoney(split.interest, "UGX")}
          </span>{" "}
          interest ·{" "}
          <span className="tabular-nums text-foreground">
            {formatMoney(split.principal, "UGX")}
          </span>{" "}
          off the balance
        </p>
      ) : null}

      {split && !split.coversInterest && split.accruedInterest > 0 ? (
        <p className="text-destructive">
          This does not cover the {formatMoney(split.accruedInterest, "UGX")} interest owed, so
          the balance will not come down.
        </p>
      ) : null}

      {split && split.overpayment > 0 ? (
        <p className="text-muted-foreground">
          {formatMoney(split.overpayment, "UGX")} more than the loan needs.
        </p>
      ) : null}

      {settling && remaining !== null ? (
        <p className={clears ? "text-foreground" : "text-muted-foreground"}>
          {clears ? "Clears it." : `Leaves ${formatMoney(remaining, "UGX")} outstanding.`}
        </p>
      ) : null}
    </div>
  );
}
