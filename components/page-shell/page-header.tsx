"use client";

import type { ReactNode } from "react";

// Every top-level screen names itself. A highlighted icon in the bottom bar
// says where you tapped, not what you are looking at, and it is gone the
// moment you open a detail view.
export function PageHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0 self-start">{aside}</div> : null}
    </div>
  );
}
