"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type CaptureReviewSection = "month-close" | "capture";

// Captured items first, and at the bare /transactions/review path: it is the
// queue that accumulates work, so it is what "review" should mean by default.
const sectionConfig: Record<CaptureReviewSection, { href: string; label: string }> = {
  capture: { href: "/transactions/review", label: "Captured items" },
  "month-close": { href: "/transactions/review/month-close", label: "Month close" },
};

export function CaptureReviewSectionLinks({
  current,
}: {
  current: CaptureReviewSection;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.entries(sectionConfig) as Array<[CaptureReviewSection, { href: string; label: string }]>).map(
        ([key, route]) => (
          <Button key={route.href} asChild size="sm" variant={current === key ? "default" : "outline"}>
            <Link href={route.href}>{route.label}</Link>
          </Button>
        ),
      )}
    </div>
  );
}
