"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { navItems } from "@/lib/data";

import { IconSettings } from "@tabler/icons-react";

import { AppBrand, isActiveRoute, navIcons, ThemeToggle } from "./navigation-shared";

export function DesktopNavigation({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 hidden bg-background/92 pt-3 backdrop-blur supports-backdrop-filter:bg-background/84 lg:block">
      <div className="flex items-center gap-4 py-1">
        <div className="shrink-0">
          <AppBrand />
        </div>
        <nav className="min-w-0 flex-1">
          <div className="grid grid-cols-6 gap-1">
            {navItems.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);
              const IconComponent = navIcons[item.href];

              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  className={[
                    "h-11 w-full border-b-2 px-2 text-sm shadow-none",
                    isActive
                      ? "border-b-primary text-foreground dark:border-b-cyan-400 dark:text-cyan-100"
                      : "border-b-transparent text-muted-foreground/80 hover:text-foreground",
                  ].join(" ")}
                >
                  <Link href={item.href}>
                    <span className="flex w-full items-center justify-center gap-2">
                      <span
                        className={[
                          "inline-flex h-5 w-5 items-center justify-center transition-colors",
                          isActive ? "text-primary dark:text-cyan-300" : "text-muted-foreground/80",
                        ].join(" ")}
                      >
                        <IconComponent
                          className={isActive ? "h-4 w-4" : "h-3.75 w-3.75"}
                          stroke={isActive ? 1.9 : 1.7}
                        />
                      </span>
                      <span className="min-w-0 truncate text-center font-medium tracking-tight">
                        {item.label}
                      </span>
                    </span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={[
              "h-10 w-10 border-border/30",
              isActiveRoute(pathname, "/settings")
                ? "text-foreground"
                : "text-muted-foreground/80 hover:text-foreground",
            ].join(" ")}
          >
            <Link href="/settings" aria-label="Settings">
              <IconSettings className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle onClick={onToggleTheme} className="h-10 w-10 border-border/30" />
        </div>
      </div>
      <Separator className="bg-border/50" />
    </div>
  );
}
