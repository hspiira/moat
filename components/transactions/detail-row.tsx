"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1 text-sm", className)}>
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right text-foreground tabular-nums">{children}</span>
    </div>
  );
}

export function DetailFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </>
  );
}

export function DetailFacts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">{children}</dl>;
}

export function DetailNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm wrap-anywhere text-foreground">{children}</p>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-0.5">
      {title ? (
        <h3 className="pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
