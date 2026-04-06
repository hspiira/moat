"use client";

import type { PeriodFilter } from "@/lib/domain/dashboard";
import { Button } from "@/components/ui/button";

const periodOptions: { id: PeriodFilter; label: string }[] = [
  { id: "week", label: "W" },
  { id: "month", label: "M" },
  { id: "year", label: "Y" },
  { id: "all", label: "All" },
];

export function DashboardPeriodFilter({
  period,
  onChange,
}: {
  period: PeriodFilter;
  onChange: (period: PeriodFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1 border border-border/30 p-1">
      {periodOptions.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={period === option.id ? "secondary" : "ghost"}
          className="min-w-9"
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
