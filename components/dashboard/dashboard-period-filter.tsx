"use client";

import type { PeriodFilter } from "@/lib/domain/dashboard";
import { Button } from "@/components/ui/button";

// Single letters keep four choices on one row with the heading at 320px. The
// full name is what a screen reader reads, and what the tooltip says.
const periodOptions: { id: PeriodFilter; label: string; name: string }[] = [
  { id: "week", label: "W", name: "This week" },
  { id: "month", label: "M", name: "This month" },
  { id: "year", label: "Y", name: "This year" },
  { id: "all", label: "All", name: "All time" },
];

export function DashboardPeriodFilter({
  period,
  onChange,
}: {
  period: PeriodFilter;
  onChange: (period: PeriodFilter) => void;
}) {
  return (
    <div role="group" aria-label="Cash flow period" className="flex items-center gap-0.5">
      {periodOptions.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={period === option.id ? "secondary" : "ghost"}
          aria-pressed={period === option.id}
          aria-label={option.name}
          title={option.name}
          className="h-9 min-w-10 px-2"
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
