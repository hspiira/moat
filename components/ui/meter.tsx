"use client";

import { cn } from "@/lib/utils";

type MeterTone = "positive" | "warning" | "negative" | "neutral";

const toneFill: Record<MeterTone, string> = {
  positive: "bg-pos",
  warning: "bg-clay",
  negative: "bg-neg",
  neutral: "bg-muted-foreground/40",
};

export function Meter({
  fraction,
  tone = "positive",
  valueLabel,
  className,
}: {
  fraction: number;
  tone?: MeterTone;
  valueLabel: string;
  className?: string;
}) {
  const safe = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const percent = Math.round(safe * 100);

  return (
    <div
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={valueLabel}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      {percent > 0 ? (
        <div
          className={cn("h-full rounded-full transition-[width]", toneFill[tone])}
          style={{ width: `${percent}%` }}
        />
      ) : null}
    </div>
  );
}
