"use client";

import Link from "next/link";
import { IconChevronDown, IconSettings } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navItems } from "@/lib/data";

import { AppBrand, isActiveRoute, navIcons, ThemeToggle } from "./navigation-shared";

// One row, always. The old grid gave every destination an equal column, so
// adding a tenth wrapped the bar into a ragged second line. These four are the
// daily routes; the rest sit one click away rather than competing for width.
const primaryNav = ["/", "/transactions", "/accounts", "/report"] as const;

export function DesktopNavigation({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  const overflowItems = navItems.filter(
    (item) => !primaryNav.includes(item.href as (typeof primaryNav)[number]),
  );
  const activeOverflowItem = overflowItems.find((item) => isActiveRoute(pathname, item.href));

  return (
    <div className="sticky top-0 z-40 hidden bg-background/92 pt-3 backdrop-blur supports-backdrop-filter:bg-background/84 lg:block">
      <div className="flex items-center gap-6 py-1">
        <div className="shrink-0">
          <AppBrand />
        </div>

        <nav aria-label="Primary" className="flex min-w-0 flex-1 items-center gap-1">
          {primaryNav.map((href) => {
            const item = navItems.find((entry) => entry.href === href);
            if (!item) return null;

            const isActive = isActiveRoute(pathname, item.href);
            const IconComponent = navIcons[item.href];

            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={[
                  "h-10 rounded-full px-4 text-sm shadow-none",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                  <IconComponent className="size-4" stroke={isActive ? 2 : 1.7} />
                  <span className="font-medium tracking-tight">{item.label}</span>
                </Link>
              </Button>
            );
          })}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={[
                  "h-10 rounded-full px-4 text-sm shadow-none",
                  activeOverflowItem
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className="font-medium tracking-tight">
                  {activeOverflowItem?.label ?? "More"}
                </span>
                <IconChevronDown className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-1.5">
              <div className="grid">
                {overflowItems.map((item) => {
                  const IconComponent = navIcons[item.href];
                  const isActive = isActiveRoute(pathname, item.href);

                  return (
                    <PopoverClose key={item.href} asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        ].join(" ")}
                      >
                        {IconComponent ? <IconComponent className="size-4 shrink-0" /> : null}
                        {item.label}
                      </Link>
                    </PopoverClose>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={[
              "size-10 rounded-full",
              isActiveRoute(pathname, "/settings")
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Link href="/settings" aria-label="Settings">
              <IconSettings className="size-4" />
            </Link>
          </Button>
          <ThemeToggle onClick={onToggleTheme} className="size-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
