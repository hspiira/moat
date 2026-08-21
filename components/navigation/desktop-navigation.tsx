"use client";

import Link from "next/link";
import { IconChevronDown, IconSettings } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navItems } from "@/lib/data";

import {
  AppBrand,
  getActiveEntryIn,
  getNavEntry,
  isActiveRoute,
  navGroupsExcluding,
  navIcons,
  ThemeToggle,
} from "./navigation-shared";

export const desktopPrimaryNav = ["/", "/transactions", "/accounts", "/report"] as const;
// Settings has its own gear in the same bar, so the menu does not repeat it.
export const desktopShortcutNav = ["/settings"] as const;

const desktopMenuGroups = navGroupsExcluding([...desktopPrimaryNav, ...desktopShortcutNav]);
export const desktopMenuHrefs = desktopMenuGroups.flatMap((group) => group.hrefs);

export function DesktopNavigation({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  const activeMenuItem = getActiveEntryIn(pathname, desktopMenuHrefs);

  return (
    <div className="sticky top-0 z-40 hidden bg-background/92 pt-3 backdrop-blur supports-backdrop-filter:bg-background/84 lg:block">
      <div className="flex items-center gap-6 py-1">
        <div className="shrink-0">
          <AppBrand />
        </div>

        <nav aria-label="Primary" className="flex min-w-0 flex-1 items-center gap-1">
          {desktopPrimaryNav.map((href) => {
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
                  activeMenuItem
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className="font-medium tracking-tight">
                  {activeMenuItem?.label ?? "More"}
                </span>
                <IconChevronDown className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-1.5">
              <div className="grid gap-2">
                {desktopMenuGroups.map((group) => (
                  <section key={group.title} className="grid">
                    <div className="px-3 pb-0.5 text-[11px] font-medium text-muted-foreground">
                      {group.title}
                    </div>
                    {group.hrefs.map((href) => {
                      const item = getNavEntry(href);
                      if (!item) return null;

                      const IconComponent = navIcons[href];
                      const isActive = isActiveRoute(pathname, href);

                      return (
                        <PopoverClose key={href} asChild>
                          <Link
                            href={href}
                            aria-current={isActive ? "page" : undefined}
                            className={[
                              "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
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
                  </section>
                ))}
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
