"use client";

import type { ReactNode } from "react";

export function EmptyState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground ${className}`.trim()}
    >
      {children}
    </div>
  );
}
