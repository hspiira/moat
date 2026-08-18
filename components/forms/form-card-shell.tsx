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

export function FormCardShell({ title, description, children, footer, embedded, plain }: Props) {
  if (plain) {
    return (
      <div className="grid gap-4">
        {children}
        {footer}
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
            className="sticky bottom-0 bg-background px-4 py-3"
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
