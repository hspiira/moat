"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

type TransactionsRoute = "ledger" | "capture" | "import" | "review" | "tools";

/**
 * The tab row carries only the daily loop (see money, add money, fix money).
 * Import and Tools are maintenance utilities: on mobile they live in the More
 * drawer's "Data tools" section; on larger screens they get quiet links here.
 */
const primaryRoutes = [
  { key: "ledger", href: "/transactions", label: "Ledger" },
  { key: "capture", href: "/transactions/capture", label: "Capture" },
  { key: "review", href: "/transactions/review", label: "Review" },
] as const;

const utilityRoutes = [
  { key: "import", href: "/transactions/import", label: "Import" },
  { key: "tools", href: "/transactions/tools", label: "Tools" },
] as const;

export function TransactionsRouteLinks({
  current,
}: {
  current: TransactionsRoute;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="grid w-full max-w-sm grid-cols-3 gap-1 rounded-md bg-muted/60 p-1 sm:w-auto sm:min-w-72">
        {primaryRoutes.map((route) => (
          <Link
            key={route.key}
            href={route.href}
            aria-current={current === route.key ? "page" : undefined}
            className={cn(
              "rounded-sm px-3 py-1.5 text-center text-sm font-medium transition-colors",
              current === route.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {route.label}
          </Link>
        ))}
      </div>

      <div className="hidden items-center gap-4 sm:flex">
        {utilityRoutes.map((route) => (
          <Link
            key={route.key}
            href={route.href}
            aria-current={current === route.key ? "page" : undefined}
            className={cn(
              "text-sm transition-colors",
              current === route.key
                ? "font-medium text-foreground underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {route.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
