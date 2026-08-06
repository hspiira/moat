"use client";

import Link from "next/link";
import { useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconBuildingBank,
  IconBusinessplan,
  IconChalkboard,
  IconFileImport,
  IconHome2,
  IconLock,
  IconMenu2,
  IconMessage2,
  IconMoon,
  IconPlus,
  IconSchool,
  IconCreditCard,
  IconRepeat,
  IconSettings,
  IconWallet,
  IconSun,
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
  "/goals": IconBusinessplan,
  "/budgets": IconWallet,
  "/debt": IconCreditCard,
  "/recurring": IconRepeat,
  "/investment-compass": IconChalkboard,
  "/learn": IconSchool,
  "/settings": IconSettings,
  "/privacy": IconLock,
};

export const mobilePrimaryNav = ["/", "/transactions", "/accounts"] as const;
export const mobileSecondaryNav = [
  "/goals",
  "/budgets",
  "/debt",
  "/recurring",
  "/investment-compass",
  "/learn",
] as const;
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
    description: "Read a transaction from an SMS or notification.",
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


export function getMobileContextNavItem(pathname: string) {
  return mobileContextNav.find((item) => isActiveRoute(pathname, item.href));
}

export function MoatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={className}
      role="img"
      aria-label="Moat"
      fill="none"
    >
      {/* The moat: a protective ring around what you're building. */}
      <circle cx="22" cy="22" r="18.5" stroke="var(--primary)" strokeWidth="3" />
      <circle cx="22" cy="22" r="12" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="22" cy="22" r="6" fill="var(--primary)" />
    </svg>
  );
}

export function AppBrand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <MoatMark className="h-10 w-10 shrink-0" />
      <span>
        <span className="block font-display text-base font-semibold tracking-tight text-foreground">
          Moat
        </span>
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

export function QuickActionLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid gap-2">
      <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-muted/40 px-3 py-3 whitespace-normal shadow-none">
        <Link href="/transactions/capture" onClick={onNavigate}>Capture transactions</Link>
      </Button>
      <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-muted/40 px-3 py-3 whitespace-normal shadow-none">
        <Link href="/transactions/import" onClick={onNavigate}>Import statements</Link>
      </Button>
      <Button asChild variant="ghost" className="h-auto justify-start rounded-lg bg-muted/40 px-3 py-3 whitespace-normal shadow-none">
        {/* Names both things the screen hosts. "Review month close" gave no
            reason to open it if what you wanted was recurring bills. */}
        <Link href="/transactions/review/month-close" onClick={onNavigate}>
          Recurring bills &amp; month close
        </Link>
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
  onNavigate,
}: {
  href: string;
  label: string;
  description: string;
  icon: Icon;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      className="h-auto justify-start px-0 py-0 whitespace-normal shadow-none"
    >
      <Link
        href={href}
        onClick={onNavigate}
        className="grid w-full gap-1 rounded-lg px-3 py-3 text-left"
      >
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
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Capture transaction"
          className="size-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-none hover:bg-primary/90 dark:text-primary-foreground"
        >
          <IconPlus className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-6">
          <SheetTitle>Capture</SheetTitle>
          <SheetDescription>
            Pick the fastest way to add a transaction. Anything read from a message goes to review first.
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
                className="h-auto justify-start px-0 py-0 whitespace-normal shadow-none"
              >
                <Link
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="grid w-full gap-1 rounded-lg bg-muted/40 px-4 py-3 text-left"
                >
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
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            <QuickActionLinks onNavigate={close} />
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
                    onNavigate={close}
                  />
                );
              })}
            </div>
          </DrawerSection>

          <DrawerSection title="Data tools">
            <div className="grid">
              <DrawerNavRow
                href="/transactions/import"
                label="CSV import"
                description="Bring in bank or mobile money statements"
                icon={IconFileImport}
                active={isActiveRoute(pathname, "/transactions/import")}
                onNavigate={close}
              />
              <DrawerNavRow
                href="/transactions/tools"
                // Budgets are the most-wanted thing behind this row and used to
                // appear only third in the description, under a label naming
                // neither. 145 lines of budget logic nobody could find.
                label="Budgets & rules"
                description="Spending limits, auto-categorisation, correction log"
                icon={IconAdjustmentsHorizontal}
                active={isActiveRoute(pathname, "/transactions/tools")}
                onNavigate={close}
              />
            </div>
          </DrawerSection>

          <DrawerSection title="Theme & settings">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="text-sm text-muted-foreground">Switch between light and dark mode.</div>
              <ThemeToggle onClick={onToggleTheme} className="h-10 w-10 border-border/30" />
            </div>
            <DrawerNavRow
              href="/settings"
              label="Settings"
              description="PIN lock, backup, data export, privacy"
              icon={IconSettings}
              active={isActiveRoute(pathname, "/settings")}
              onNavigate={close}
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
          <IconMenu2 className="h-4.5 w-4.5" />
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
  const IconComponent = activeContextItem ? navIcons[activeContextItem.href] : IconMenu2;
  const label = activeContextItem?.label ?? "More";

  return (
    <MobileUtilitySheet
      pathname={pathname}
      onToggleTheme={onToggleTheme}
      trigger={
        <Button
          variant="ghost"
          aria-label={label}
          className={[
            "flex h-11 items-center justify-center gap-2 rounded-full px-3 shadow-none",
            "transition-[background-color,color,padding] duration-200 ease-out",
            isActive
              ? "bg-primary pr-4 pl-3.5 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <IconComponent className="size-5 shrink-0" stroke={isActive ? 2 : 1.7} />
          {isActive ? (
            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
          ) : null}
        </Button>
      }
    />
  );
}
