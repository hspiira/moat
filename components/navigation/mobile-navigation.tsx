"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { navItems } from "@/lib/data";

import {
  isActiveRoute,
  mobilePrimaryNav,
  MobileMoreButton,
  MobileNavTrigger,
  navIcons,
} from "./navigation-shared";

export function MobileNavigation({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  const activeItem = navItems.find((item) => isActiveRoute(pathname, item.href)) ?? navItems[0];

  return (
    <>
      <Card className="sticky top-0 z-40 border-x-0 border-t-0 border-border/30 bg-background/92 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/84 lg:hidden">
        <CardContent className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/icons/logo.svg"
              alt="Moat logo"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
              priority
            />
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Moat
              </div>
              <div className="truncate text-base font-semibold tracking-tight text-foreground">
                {activeItem.label}
              </div>
            </div>
          </div>

          <MobileNavTrigger pathname={pathname} onToggleTheme={onToggleTheme} />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/30 bg-background/96 backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden">
        <div className="px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1">
          <nav className="grid grid-cols-5 gap-1">
            {mobilePrimaryNav.map((href) => {
              const item = navItems.find((entry) => entry.href === href);
              if (!item) return null;

              const isActive = isActiveRoute(pathname, item.href);
              const IconComponent = navIcons[item.href];

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  className={[
                    "h-auto min-h-12 flex-col gap-0.5 px-2 py-1 text-center text-[11px] font-medium shadow-none",
                    isActive
                      ? "text-foreground dark:text-cyan-100"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                    <span
                      className={[
                        "inline-flex h-6 w-10 items-center justify-center transition-colors",
                        isActive ? "text-primary dark:text-cyan-300" : "bg-transparent",
                      ].join(" ")}
                    >
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <span className="leading-none">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            <MobileMoreButton pathname={pathname} onToggleTheme={onToggleTheme} />
          </nav>
        </div>
      </div>
    </>
  );
}
