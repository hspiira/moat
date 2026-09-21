"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@tabler/icons-react";

// A settings detail is reached from the index, so it says where back goes
// rather than relying on the browser's own control, which a home-screen app
// does not always show.
export function SettingsDetailShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <Link
          href="/settings"
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <IconChevronLeft aria-hidden className="size-4" />
          Settings
        </Link>
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}
