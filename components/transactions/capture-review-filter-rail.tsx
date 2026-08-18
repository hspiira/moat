"use client";

import { cn } from "@/lib/utils";
import {
  captureReviewSectionLabels,
  captureReviewSections,
  type CaptureReviewSection,
} from "@/lib/domain/capture-review";

export function CaptureReviewFilterRail({
  section,
  counts,
  onSelect,
}: {
  section: CaptureReviewSection;
  counts: Record<CaptureReviewSection, number>;
  onSelect: (section: CaptureReviewSection) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Capture inbox sections"
      className="grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-0.5"
    >
      {captureReviewSections.map((value) => {
        const isActive = section === value;
        const count = counts[value];
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(value)}
            className={cn(
              "min-w-0 truncate rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {captureReviewSectionLabels[value]}
            {count > 0 ? (
              <span
                className={cn(
                  "ml-1.5 text-xs tabular-nums",
                  isActive ? "text-primary-foreground/70" : "text-muted-foreground/70",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
