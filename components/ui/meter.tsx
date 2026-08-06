"use client";

import { cn } from "@/lib/utils";

type MeterTone = "positive" | "warning" | "negative" | "neutral";

const toneFill: Record<MeterTone, string> = {
  positive: "bg-pos",
  warning: "bg-clay",
  negative: "bg-neg",
  neutral: "bg-muted-foreground/40",
};

/**
 * A single-value fill against a target — the right form for "how much of this
 * envelope is gone", where a chart would be overkill.
 *
 * The tone is a reserved status colour and is never the only signal: the amber
 * and red steps sit close enough in hue that a colour-blind reader could not
 * separate them, so callers state the status in text and this bar reinforces it.
 * `valueLabel` carries that text into the accessible name.
 */
export function Meter({
  fraction,
  tone = "positive",
  valueLabel,
  className,
}: {
  /** 0–1. Callers clamp; anything outside is clamped again here. */
  fraction: number;
  tone?: MeterTone;
  /** Human-readable state, e.g. "USh 24,000 of USh 100,000 spent". */
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
      {/* Rounded data-end anchored to the baseline; a zero-width fill is not
          rendered at all so an empty envelope shows no stray dot. */}
      {percent > 0 ? (
        <div
          className={cn("h-full rounded-full transition-[width]", toneFill[tone])}
          style={{ width: `${percent}%` }}
        />
      ) : null}
    </div>
  );
}
