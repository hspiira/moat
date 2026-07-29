"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  captureReviewSectionLabels,
  captureReviewSections,
  type CaptureReviewSection,
} from "@/lib/domain/capture-review";

/**
 * One segmented control, not five buttons — same treatment as the capture
 * page's method switcher, so a filter looks like a filter everywhere in the app.
 * Five default-size buttons wrapped onto two rows on a phone and read as five
 * unrelated actions.
 *
 * Counts appear only when non-zero: a row of "0"s is noise, it widened the rail
 * enough to push two sections off a phone screen, and set in a mono face the
 * slashed zero read as a rendering glitch.
 */
export function CaptureReviewFilterRail({
  section,
  counts,
  onSelect,
}: {
  section: CaptureReviewSection;
  counts: Record<CaptureReviewSection, number>;
  onSelect: (section: CaptureReviewSection) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Five tabs do not fit a phone, so the rail scrolls. Keeping the active one
  // in view means a section is never selected-but-invisible — including when
  // something outside this control changes the section.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [section]);

  return (
    // min-w-0 is load-bearing. This wrapper is a grid item, so its min-width
    // resolves to min-content; the scroller below is a block child, and
    // overflow-x only zeroes the min-content contribution of flex/grid items,
    // not of blocks. Without it the tabs' ~490px intrinsic width propagates up
    // and stretches the whole page.
    <div
      role="tablist"
      aria-label="Capture inbox sections"
      className="flex min-w-0 gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {captureReviewSections.map((value) => {
        const isActive = section === value;
        const count = counts[value];
        return (
          <button
            key={value}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(value)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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
