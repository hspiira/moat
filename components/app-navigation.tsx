"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { navItems } from "@/lib/data";

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <Card className="border-border/70 bg-background/95 shadow-lg shadow-primary/5">
      <CardContent className="flex flex-col gap-5 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Moat
            </Badge>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                Routed app shell for issue #2
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Home, accounts, transactions, goals, Investment Compass, and Learn
                Uganda now have dedicated surfaces.
              </p>
            </div>
          </div>

          <Button asChild variant="outline">
            <Link href="/">Back to overview</Link>
          </Button>
        </div>

        <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg border px-3 py-3 transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 bg-background/75 text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="mt-1 text-xs leading-5">{item.description}</div>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
