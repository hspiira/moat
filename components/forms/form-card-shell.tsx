"use client";

import type { ReactNode } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  embedded?: boolean;
  plain?: boolean;
};

// Full-screen forms scroll past the fold, so Save rides the bottom of the
// viewport rather than waiting at the end of the fields. On mobile it parks
// above the navigation bar, which is fixed over the same corner.
const stickyFooterClass =
  "sticky bottom-[calc(4.5rem+max(0.625rem,env(safe-area-inset-bottom)))] z-30 rounded-xl border border-border/60 bg-background/95 p-2 backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none";

export function FormCardShell({ title, description, children, footer, embedded, plain }: Props) {
  if (plain) {
    return (
      <div className="grid gap-4">
        {children}
        {footer ? <div className={stickyFooterClass}>{footer}</div> : null}
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="flex min-h-full flex-col">
        <AccentCardHeader title={title} description={description} className="rounded-none" />
        <div className="flex-1 px-4 pt-4 pb-6">{children}</div>
        {footer ? (
          <div
            className="sticky bottom-0 border-t border-border/60 bg-background px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="gap-0 pt-0 shadow-none">
      <AccentCardHeader title={title} description={description} />
      <CardContent className="p-5">{children}</CardContent>
      {footer ? <CardContent className="px-5 pb-5">{footer}</CardContent> : null}
    </Card>
  );
}
