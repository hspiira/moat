"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { navItems } from "@/lib/data";

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Card className="border-border/40 bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-foreground">
              Moat
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              — Personal finance
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {mounted && resolvedTheme === "dark" ? (
              <IconSun className="h-4 w-4" />
            ) : (
              <IconMoon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-md border px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "border-border/60 bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/40 hover:bg-muted/50 hover:text-foreground",
                ].join(" ")}
              >
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-xs leading-4 opacity-70">{item.description}</div>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
