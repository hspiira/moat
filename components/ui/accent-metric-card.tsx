"use client";

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { AccentTone } from "@/components/accent-card-header";

const toneClassNames: Record<AccentTone, string> = {
  yellow: "moat-panel-yellow",
  lilac: "moat-panel-lilac",
  mint: "moat-panel-mint",
  sage: "moat-panel-sage",
};

export function AccentMetricCard({
  tone,
  kicker,
  value,
  description,
}: {
  tone: AccentTone;
  kicker: string;
  value: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Card className={`${toneClassNames[tone]} border-border/20 shadow-none`}>
      <CardContent className="grid gap-2 p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">{kicker}</div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {description ? <div className="text-sm text-foreground/75">{description}</div> : null}
      </CardContent>
    </Card>
  );
}
