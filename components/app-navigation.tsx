"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconBuildingBank,
  IconCompass,
  IconHome2,
  IconMenu2,
  IconMoon,
  IconPlus,
  IconSchool,
  IconSun,
  IconTargetArrow,
  IconTransfer,
  type Icon,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItems } from "@/lib/data";

const navIcons: Record<string, Icon> = {
  "/": IconHome2,
  "/accounts": IconBuildingBank,
  "/transactions": IconTransfer,
  "/goals": IconTargetArrow,
  "/investment-compass": IconCompass,
  "/learn": IconSchool,
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

const mobilePrimaryNav = ["/", "/transactions", "/goals", "/investment-compass"] as const;
const mobileSecondaryNav = ["/accounts", "/learn"] as const;

function AppBrand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/icons/logo.svg"
        alt="Moat logo"
        width={44}
        height={44}
        className="h-11 w-11"
        priority
      />
      <span>
        <span className="block text-base font-semibold tracking-tight text-foreground">
          Moat
        </span>
        <span className="block text-xs text-muted-foreground">
          Personal finance for Uganda
        </span>
      </span>
    </Link>
  );
}

function ThemeToggle({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label="Toggle theme"
      className={className}
    >
      <IconSun className="hidden h-4 w-4 dark:block" />
      <IconMoon className="h-4 w-4 dark:hidden" />
    </Button>
  );
}

function QuickActionLinks() {
  return (
    <div className="grid gap-2">
      <Button asChild variant="outline" className="justify-start">
        <Link href="/transactions">Add or import transactions</Link>
      </Button>
      <Button asChild variant="outline" className="justify-start">
        <Link href="/accounts">Add or update accounts</Link>
      </Button>
      <Button asChild variant="outline" className="justify-start">
        <Link href="/goals">Create or review goals</Link>
      </Button>
    </div>
  );
}

function MobileUtilitySheet({
  pathname,
  onToggleTheme,
  trigger,
}: {
  pathname: string;
  onToggleTheme: () => void;
  trigger: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-6">
          <SheetTitle>Navigation and actions</SheetTitle>
          <SheetDescription>
            Move between routes, manage quick actions, and switch theme.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-6">
          <Card className="border-border/30 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActionLinks />
            </CardContent>
          </Card>
          <Card className="border-border/30 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">More places</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {mobileSecondaryNav.map((href) => {
                const item = navItems.find((entry) => entry.href === href);
                if (!item) {
                  return null;
                }
                const IconComponent = navIcons[item.href];
                const isActive = isActiveRoute(pathname, item.href);

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? "secondary" : "ghost"}
                    className="h-auto justify-start px-3 py-3"
                  >
                    <Link href={item.href}>
                      <span className="flex items-start gap-3">
                        <IconComponent className="mt-0.5 h-4 w-4" />
                        <span className="text-left">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
          <Card className="border-border/30 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Theme</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Switch between light and dark mode.
              </div>
              <ThemeToggle
                onClick={onToggleTheme}
                className="h-10 w-10 border-border/30"
              />
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const activeItem =
    navItems.find((item) => isActiveRoute(pathname, item.href)) ?? navItems[0];

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

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

          <MobileUtilitySheet
            pathname={pathname}
            onToggleTheme={toggleTheme}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation and actions"
                className="h-9 w-9"
              >
                <IconMenu2 className="h-[18px] w-[18px]" />
              </Button>
            }
          />
        </CardContent>
      </Card>

      <div className="sticky top-0 z-40 hidden bg-background/92 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/84 lg:block">
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
                        isActive
                          ? "text-primary dark:text-cyan-300"
                          : "text-muted-foreground/80",
                      ].join(" ")}
                    >
                      <IconComponent
                        className={isActive ? "h-4 w-4" : "h-[15px] w-[15px]"}
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

          <div className="flex shrink-0 items-center">
            <ThemeToggle
              onClick={toggleTheme}
              className="h-10 w-10 border-border/30"
            />
          </div>
        </div>
        <Separator className="bg-border/50" />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/30 bg-background/96 backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden">
        <div className="px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1">
          <nav className="grid grid-cols-5 gap-1">
          {mobilePrimaryNav.map((href) => {
            const item = navItems.find((entry) => entry.href === href);
            if (!item) {
              return null;
            }

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
                      isActive
                        ? "text-primary dark:text-cyan-300"
                        : "bg-transparent",
                    ].join(" ")}
                  >
                    <IconComponent className="h-4 w-4" />
                  </span>
                  <span className="leading-none">{item.label}</span>
                </Link>
              </Button>
            );
          })}
          <MobileUtilitySheet
            pathname={pathname}
            onToggleTheme={toggleTheme}
            trigger={
              <Button
                variant="ghost"
                className="h-auto min-h-12 flex-col gap-0.5 px-2 py-1 text-center text-[11px] font-medium text-muted-foreground shadow-none"
              >
                <span className="inline-flex h-6 w-10 items-center justify-center">
                  <IconPlus className="h-4 w-4" />
                </span>
                <span className="leading-none">More</span>
              </Button>
            }
          />
          </nav>
        </div>
      </div>
    </>
  );
}
