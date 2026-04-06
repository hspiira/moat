"use client";

import { Card, CardContent } from "@/components/ui/card";

export function MetricChip({
  value,
  label,
  className = "border-border/40 bg-muted/30",
}: {
  value: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Card className={`shadow-none ${className}`}>
      <CardContent className="px-4 py-3 text-sm">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
