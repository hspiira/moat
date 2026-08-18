"use client";

import Link from "next/link";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ErrorNotice({
  message,
  className,
}: {
  message: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

export function ErrorStateCard({ message }: { message: string }) {
  return (
    <Card className="border-none bg-destructive/10 py-0">
      <CardContent className="flex items-start gap-3 px-4 py-3.5">
        <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-destructive">Something went wrong</p>
          <p role="alert" className="text-sm text-destructive/90">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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
  onAction,
}: {
  title: string;
  message: string;
  href?: string;
  cta?: string;
  icon?: ReactNode;
  onAction?: () => void;
}) {
  return (
    <Card className="bg-muted/20">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        <div className="space-y-1">
          <p className="font-display text-base font-medium text-foreground">{title}</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{message}</p>
        </div>
        {cta && onAction ? (
          <Button size="lg" className="mt-1" onClick={onAction}>
            {cta}
            <IconArrowRight />
          </Button>
        ) : href && cta ? (
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
