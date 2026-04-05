"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  IconBook2,
  IconBuildingBank,
  IconCompass,
  IconHome2,
  IconMenu2,
  IconMoon,
  IconPlus,
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
  "/learn": IconBook2,
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

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <>
      <Card className="sticky top-0 z-40 border-border/60 bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
          <AppBrand />
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open quick actions"
                  className="h-10 w-10 rounded-2xl border-border/60"
                >
                  <IconMenu2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] rounded-t-[2rem] px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <SheetHeader className="px-6">
                  <SheetTitle>Quick actions</SheetTitle>
                  <SheetDescription>
                    High-frequency actions for the mobile app flow.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-6">
                  <QuickActionLinks />
                </div>
              </SheetContent>
            </Sheet>
            <ThemeToggle
              onClick={toggleTheme}
              className="h-10 w-10 rounded-2xl border-border/60"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hidden lg:sticky lg:top-6 lg:block lg:w-72 lg:self-start lg:border-border/60 lg:bg-card/90 lg:shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-4">
            <AppBrand />
            <ThemeToggle
              onClick={toggleTheme}
              className="h-10 w-10 rounded-2xl border-border/60"
            />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-2 p-3">
          <nav className="grid gap-2">
            {navItems.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);
              const IconComponent = navIcons[item.href];

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  className="h-auto justify-start rounded-[1.5rem] px-4 py-3"
                >
                  <Link href={item.href}>
                    <span className="flex items-start gap-3">
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
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-75">
                        {item.description}
                      </span>
                    </span>
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      <Card className="fixed inset-x-2 bottom-2 z-50 border-border/70 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden">
        <CardContent className="px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          <nav className="mx-auto grid max-w-4xl grid-cols-5 gap-1">
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
                variant={isActive ? "default" : "ghost"}
                className="h-auto min-h-16 flex-col gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium"
              >
                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                  <IconComponent className="h-4 w-4" />
                  <span className="leading-none">{item.label}</span>
                </Link>
              </Button>
            );
          })}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto min-h-16 flex-col gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium text-muted-foreground"
              >
                <IconPlus className="h-4 w-4" />
                <span className="leading-none">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-[2rem] px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <SheetHeader className="px-6">
                <SheetTitle>Navigation and actions</SheetTitle>
                <SheetDescription>
                  Use the primary tabs for daily work and this panel for everything else.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 px-6">
                <Card className="border-border/60 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QuickActionLinks />
                  </CardContent>
                </Card>
                <Card className="border-border/60 shadow-none">
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
                <Card className="border-border/60 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Theme</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      Switch between light and dark mode.
                    </div>
                    <ThemeToggle
                      onClick={toggleTheme}
                      className="h-10 w-10 rounded-2xl border-border/60"
                    />
                  </CardContent>
                </Card>
              </div>
            </SheetContent>
          </Sheet>
          </nav>
        </CardContent>
      </Card>
    </>
  );
}
