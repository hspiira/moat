"use client";

import type { ReactNode } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  /**
   * Action bar (e.g. submit/cancel). When embedded, it's pinned to the bottom
   * of the sheet so it stays reachable and the form fills the height instead
   * of leaving dead space below a short body.
   */
  footer?: ReactNode;
  /** When true, render as a full-bleed panel (for use inside a sheet) instead of a bordered card. */
  embedded?: boolean;
};

/**
 * Shared wrapper for the transaction/goal/account forms: a full-bleed panel
 * with an accent header when embedded in a sheet, or a bordered card
 * elsewhere. Both variants share the same accent header treatment.
 */
export function FormCardShell({ title, description, children, footer, embedded }: Props) {
  if (embedded) {
    return (
      <div className="flex min-h-full flex-col">
        <AccentCardHeader tone="yellow" title={title} description={description} className="rounded-none" />
        <div className="flex-1 px-4 pt-4 pb-6">{children}</div>
        {footer ? (
          <div
            className="sticky bottom-0 border-t border-border/40 bg-background px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader tone="yellow" title={title} description={description} />
      <CardContent className="p-5">{children}</CardContent>
      {footer ? <CardContent className="px-5 pb-5">{footer}</CardContent> : null}
    </Card>
  );
}
