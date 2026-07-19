"use client";

import Link from "next/link";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ErrorStateCard({ message }: { message: string }) {
  return (
    <Card className="border-none bg-destructive/8 ring-1 ring-destructive/25">
      <CardContent className="flex items-start gap-3 px-5 py-4">
        <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-destructive">Something went wrong</p>
          <p role="alert" className="text-sm text-destructive/90">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading state as content-shaped skeletons rather than a text line, so the
 * page never flashes blank and the layout doesn't jump when data arrives.
 */
export function LoadingStateCard({ message }: { message?: string }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="grid gap-3 px-5 py-5">
        <span className="sr-only">{message ?? "Loading…"}</span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-3 gap-3 pt-1">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyStateCard({
  title,
  message,
  href,
  cta,
  icon,
}: {
  title: string;
  message: string;
  href?: string;
  cta?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        <div className="space-y-1">
          <p className="font-display text-base font-medium text-foreground">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
        </div>
        {href && cta ? (
          <Button asChild size="lg" className="mt-1">
            <Link href={href}>
              {cta}
              <IconArrowRight />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SetupRequiredCard({
  message,
  href,
  cta,
}: {
  message: string;
  href: string;
  cta: string;
}) {
  return <EmptyStateCard title="Nothing here yet" message={message} href={href} cta={cta} />;
}
