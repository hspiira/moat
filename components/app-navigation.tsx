"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconBook2,
  IconBuildingBank,
  IconCompass,
  IconHome2,
  IconMoon,
  IconSun,
  IconTargetArrow,
  IconTransfer,
  type Icon,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/data";

const navIcons: Record<string, Icon> = {
  "/": IconHome2,
  "/accounts": IconBuildingBank,
  "/transactions": IconTransfer,
  "/goals": IconTargetArrow,
  "/investment-compass": IconCompass,
  "/learn": IconBook2,
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <>
      <header className="sticky top-0 z-40 rounded-[1.75rem] border border-border/60 bg-background/90 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20">
              M
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight text-foreground">
                Moat
              </span>
              <span className="block text-xs text-muted-foreground">
                Uganda finance PWA
              </span>
            </span>
          </Link>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-10 w-10 rounded-2xl border-border/60 text-muted-foreground hover:text-foreground"
          >
            <IconSun className="hidden h-4 w-4 dark:block" />
            <IconMoon className="h-4 w-4 dark:hidden" />
          </Button>
        </div>
      </header>

      <aside className="hidden lg:sticky lg:top-6 lg:block lg:h-fit lg:w-72 lg:self-start">
        <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/90 shadow-sm backdrop-blur">
          <div className="border-b border-border/60 px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm shadow-primary/20">
                  M
                </span>
                <span>
                  <span className="block text-base font-semibold tracking-tight text-foreground">
                    Moat
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Personal finance for Uganda
                  </span>
                </span>
              </Link>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="h-10 w-10 rounded-2xl border-border/60 text-muted-foreground hover:text-foreground"
              >
                <IconSun className="hidden h-4 w-4 dark:block" />
                <IconMoon className="h-4 w-4 dark:hidden" />
              </Button>
            </div>
          </div>

          <nav className="grid gap-2 p-3">
            {navItems.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);
              const IconComponent = navIcons[item.href];

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group rounded-[1.5rem] border px-4 py-3 transition-colors",
                    isActive
                      ? "border-primary/25 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        "mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                        isActive
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-border/60 bg-background text-muted-foreground group-hover:text-foreground",
                      ].join(" ")}
                    >
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-75">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
        <div className="mx-auto grid max-w-4xl grid-cols-6 gap-1">
          {navItems.map((item) => {
            const isActive = isActiveRoute(pathname, item.href);
            const IconComponent = navIcons[item.href];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <IconComponent className="h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
