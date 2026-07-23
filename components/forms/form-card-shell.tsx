"use client";

import type { ReactNode } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  /** When true, render as a full-bleed panel (for use inside a sheet) instead of a bordered card. */
  embedded?: boolean;
};

/**
 * Shared wrapper for the transaction/goal/account forms: a full-bleed panel
 * with an accent header when embedded in a sheet, or a bordered card
 * elsewhere. Both variants share the same accent header treatment.
 */
export function FormCardShell({ title, description, children, embedded }: Props) {
  if (embedded) {
    return (
      <div>
        <AccentCardHeader tone="yellow" title={title} description={description} className="rounded-none" />
        <div className="px-4 pt-4 pb-6">{children}</div>
      </div>
    );
  }

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader tone="yellow" title={title} description={description} />
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
