"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  aside,
  srOnlyTitle = false,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  // When the nav already names this page, the heading stays for screen readers
  // and the browser tab but stops repeating the label visually.
  srOnlyTitle?: boolean;
}) {
  if (srOnlyTitle && !description && !aside) {
    return <h1 className="sr-only">{title}</h1>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1
          className={
            srOnlyTitle ? "sr-only" : "font-display text-2xl font-semibold tracking-tight"
          }
        >
          {title}
        </h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0 self-start">{aside}</div> : null}
    </div>
  );
}
