"use client";

import Image from "next/image";
import Link from "next/link";
import {
  IconBuildingBank,
  IconCompass,
  IconFileImport,
  IconHome2,
  IconLock,
  IconMenu2,
  IconMessage2,
  IconMoon,
  IconPlus,
  IconSchool,
  IconSettings,
  IconSun,
  IconTargetArrow,
  IconTransfer,
  type Icon,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
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
  "/settings": IconSettings,
  "/privacy": IconLock,
};

export const mobilePrimaryNav = ["/", "/transactions", "/accounts"] as const;
export const mobileSecondaryNav = ["/goals", "/investment-compass", "/learn"] as const;
const mobileContextNav = [
  {
    href: "/goals",
    label: "Goals",
    description: "Emergency fund and savings goal tracking.",
  },
  {
    href: "/investment-compass",
    label: "Compass",
    description: "Rule-based guidance for Uganda investing decisions.",
  },
  {
    href: "/learn",
    label: "Learn",
    description: "Official Uganda finance sources and explainers.",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "PIN lock, backup, data export, privacy.",
  },
  {
    href: "/privacy",
    label: "Privacy",
    description: "How Moat stores and protects your financial records.",
  },
] as const;
export const mobileCaptureActions = [
  {
    href: "/transactions/capture?capture=expense&type=expense",
    label: "Expense",
    description: "Record money spent now.",
  },
  {
    href: "/transactions/capture?capture=income&type=income",
    label: "Income",
    description: "Record incoming money.",
  },
  {
    href: "/transactions/capture?capture=transfer&type=transfer",
    label: "Transfer",
    description: "Move money between accounts.",
  },
  {
    href: "/transactions/capture?capture=text",
    label: "Paste text",
    description: "Parse SMS and notification text.",
  },
  {
    href: "/transactions/import",
    label: "Import",
    description: "Bring in statement rows from CSV.",
  },
] as const;

export function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isPrimaryMobileRoute(pathname: string) {
  return mobilePrimaryNav.some((href) => isActiveRoute(pathname, href));
}

export function getMobileTopBarTitle(pathname: string) {
  if (pathname === "/transactions/capture") {
    return "Capture";
  }

  if (pathname === "/transactions/import") {
    return "Import";
  }

  if (pathname === "/transactions/review") {
    return "Review";
  }

  if (pathname === "/transactions/review/capture") {
    return "Capture review";
  }

  if (pathname === "/transactions/tools") {
    return "Tools";
  }

  if (pathname === "/accounts") {
    return "Accounts";
  }

  if (pathname.startsWith("/accounts/")) {
    return "Account ledger";
  }

  if (pathname === "/settings") {
    return "Settings";
  }

  if (pathname === "/privacy") {
    return "Privacy";
  }

  const matchedItem = navItems.find((item) => isActiveRoute(pathname, item.href));
  return matchedItem?.label ?? "Moat";
}

export function getMobileContextNavItem(pathname: string) {
  return mobileContextNav.find((item) => isActiveRoute(pathname, item.href));
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
      <Button asChild variant="ghost" className="h-auto justify-start border border-border/20 px-3 py-3 shadow-none">
        <Link href="/transactions/capture">Capture transactions</Link>
      </Button>
      <Button asChild variant="ghost" className="h-auto justify-start border border-border/20 px-3 py-3 shadow-none">
        <Link href="/transactions/import">Import statements</Link>
      </Button>
      <Button asChild variant="ghost" className="h-auto justify-start border border-border/20 px-3 py-3 shadow-none">
        <Link href="/transactions/review">Review month close</Link>
      </Button>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function DrawerNavRow({
  href,
  label,
  description,
  icon: IconComponent,
  active,
}: {
  href: string;
  label: string;
  description: string;
  icon: Icon;
  active?: boolean;
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      className="h-auto justify-start px-0 py-0 shadow-none"
    >
      <Link href={href} className="grid w-full gap-1 border-b border-border/15 py-3 text-left">
        <span className="flex items-start gap-3">
          <IconComponent className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-left">
            <span className="block text-sm font-medium text-foreground">{label}</span>
            <span className="block text-xs text-muted-foreground">{description}</span>
          </span>
        </span>
      </Link>
    </Button>
  );
}

export function MobileCaptureSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Capture transaction"
          className="h-12 w-12 border border-border/30 bg-primary text-primary-foreground shadow-none dark:text-primary-foreground"
        >
          <IconPlus className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-6">
          <SheetTitle>Capture</SheetTitle>
          <SheetDescription>
            Start with the fastest capture path, then send machine-derived items into review before posting.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-2 overflow-y-auto overscroll-contain px-6">
          {mobileCaptureActions.map((action) => {
            const IconComponent =
              action.label === "Import"
                ? IconFileImport
                : action.label === "Paste text"
                  ? IconMessage2
                  : IconPlus;

            return (
              <Button
                key={action.href}
                asChild
                variant="ghost"
                className="h-auto justify-start px-0 py-0 shadow-none"
              >
                <Link href={action.href} className="grid w-full gap-1 border border-border/20 px-4 py-3 text-left">
                  <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <IconComponent className="h-4 w-4" />
                    {action.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
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
        className="flex max-h-[85vh] flex-col px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-6 pb-3">
          <SheetTitle>Navigation and actions</SheetTitle>
          <SheetDescription>
            Move between routes, manage quick actions, and switch theme.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-6 overflow-y-auto overscroll-contain px-6 pb-2">
          <DrawerSection title="Quick actions">
            <QuickActionLinks />
          </DrawerSection>

          <DrawerSection title="More places">
            <div className="grid">
              {mobileSecondaryNav.map((href) => {
                const item = navItems.find((entry) => entry.href === href);
                if (!item) return null;
                const IconComponent = navIcons[item.href];

                return (
                  <DrawerNavRow
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    description={item.description}
                    icon={IconComponent}
                    active={isActiveRoute(pathname, item.href)}
                  />
                );
              })}
            </div>
          </DrawerSection>

          <DrawerSection title="Theme & settings">
            <div className="flex items-center justify-between gap-3 border-b border-border/15 py-2">
              <div className="text-sm text-muted-foreground">Switch between light and dark mode.</div>
              <ThemeToggle onClick={onToggleTheme} className="h-10 w-10 border-border/30" />
            </div>
            <DrawerNavRow
              href="/settings"
              label="Settings"
              description="PIN lock, backup, data export, privacy"
              icon={IconSettings}
              active={isActiveRoute(pathname, "/settings")}
            />
          </DrawerSection>
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
  const activeContextItem = getMobileContextNavItem(pathname);
  const isActive = Boolean(activeContextItem);
  const IconComponent = activeContextItem ? navIcons[activeContextItem.href] : IconPlus;

  return (
    <MobileUtilitySheet
      pathname={pathname}
      onToggleTheme={onToggleTheme}
      trigger={
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={[
            "h-auto min-h-12 flex-col gap-0.5 px-2 py-1 text-center text-[11px] font-medium shadow-none",
            isActive ? "text-foreground dark:text-cyan-100" : "text-muted-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "inline-flex h-6 w-10 items-center justify-center transition-colors",
              isActive ? "text-primary dark:text-cyan-300" : "bg-transparent",
            ].join(" ")}
          >
            <IconComponent className="h-4 w-4" />
          </span>
          <span className="leading-none">{activeContextItem?.label ?? "More"}</span>
        </Button>
      }
    />
  );
}
