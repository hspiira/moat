"use client";

import Image from "next/image";
import Link from "next/link";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItems } from "@/lib/data";

export const navIcons: Record<string, Icon> = {
  "/": IconHome2,
  "/accounts": IconBuildingBank,
  "/transactions": IconTransfer,
  "/goals": IconTargetArrow,
  "/investment-compass": IconCompass,
  "/learn": IconSchool,
};

export const mobilePrimaryNav = ["/", "/transactions", "/accounts", "/goals"] as const;
export const mobileSecondaryNav = ["/investment-compass", "/learn"] as const;

export function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isPrimaryMobileRoute(pathname: string) {
  return navItems.some((item) => item.href === pathname);
}

export function getMobileTopBarTitle(pathname: string) {
  if (pathname === "/accounts") {
    return "Accounts";
  }

  if (pathname.startsWith("/accounts/")) {
    return "Account ledger";
  }

  const matchedItem = navItems.find((item) => isActiveRoute(pathname, item.href));
  return matchedItem?.label ?? "Moat";
}

export function AppBrand() {
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
        <span className="block text-base font-semibold tracking-tight text-foreground">Moat</span>
        <span className="block text-xs text-muted-foreground">Personal finance for Uganda</span>
      </span>
    </Link>
  );
}

export function ThemeToggle({
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

export function QuickActionLinks() {
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

export function MobileUtilitySheet({
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
                if (!item) return null;
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
              <ThemeToggle onClick={onToggleTheme} className="h-10 w-10 border-border/30" />
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileNavTrigger({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  return (
    <MobileUtilitySheet
      pathname={pathname}
      onToggleTheme={onToggleTheme}
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
  );
}

export function MobileMoreButton({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  return (
    <MobileUtilitySheet
      pathname={pathname}
      onToggleTheme={onToggleTheme}
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
  );
}
