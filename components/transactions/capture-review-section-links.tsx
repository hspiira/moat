"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type CaptureReviewSection = "month-close" | "capture";

const sectionConfig: Record<CaptureReviewSection, { href: string; label: string }> = {
  "month-close": { href: "/transactions/review", label: "Month close" },
  capture: { href: "/transactions/review/capture", label: "Capture inbox" },
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
