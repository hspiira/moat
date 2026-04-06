"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type TransactionsRoute = "ledger" | "capture" | "import" | "review" | "tools";

const routeConfig: Record<
  TransactionsRoute,
  { href: string; label: string }
> = {
  ledger: { href: "/transactions", label: "Ledger" },
  capture: { href: "/transactions/capture", label: "Capture" },
  import: { href: "/transactions/import", label: "Import" },
  review: { href: "/transactions/review", label: "Review" },
  tools: { href: "/transactions/tools", label: "Tools" },
};

export function TransactionsRouteLinks({
  current,
}: {
  current: TransactionsRoute;
}) {
  const routes = Object.entries(routeConfig) as Array<
    [TransactionsRoute, (typeof routeConfig)[TransactionsRoute]]
  >;

  return (
    <div className="flex flex-wrap gap-2">
      {routes.map(([key, route]) => (
        <Button
          key={route.href}
          asChild
          size="sm"
          variant={current === key ? "default" : "outline"}
        >
          <Link href={route.href}>{route.label}</Link>
        </Button>
      ))}
    </div>
  );
}
