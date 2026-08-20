"use client";

import Link from "next/link";
import { useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconBuildingBank,
  IconBusinessplan,
  IconCalendarCheck,
  IconChalkboard,
  IconChartHistogram,
  IconFileImport,
  IconInbox,
  IconHome2,
  IconMenu2,
  IconMessage2,
  IconMoon,
  IconPlus,
  IconSchool,
  IconCreditCard,
  IconFolders,
  IconRepeat,
  IconSettings,
  IconShoppingCart,
  IconWallet,
  IconSun,
  IconTags,
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
  "/shopping": IconShoppingCart,
  "/debt": IconCreditCard,
  "/recurring": IconRepeat,
  "/projects": IconFolders,
  "/investment-compass": IconChalkboard,
  "/learn": IconSchool,
  "/report": IconChartHistogram,
  "/settings": IconSettings,
  "/inbox": IconInbox,
  "/month": IconCalendarCheck,
  "/import": IconFileImport,
  "/settings/rules": IconAdjustmentsHorizontal,
  "/settings/categories": IconTags,
};

export const mobilePrimaryNav = ["/", "/transactions", "/accounts"] as const;

// One vocabulary for everything outside the primary slots: when a thing needs
// you, not which feature it belongs to. Both platforms render these same
// groups, so a destination cannot be reachable on one and missing on the other.
export const navGroups = [
  { title: "As things arrive", hrefs: ["/inbox"] },
  { title: "Every month", hrefs: ["/month", "/budgets", "/recurring", "/import"] },
  { title: "Look back", hrefs: ["/report"] },
  { title: "Plan ahead", hrefs: ["/goals", "/shopping", "/debt", "/investment-compass"] },
  { title: "Set up once", hrefs: ["/settings/rules", "/settings/categories", "/settings"] },
  { title: "Reference", hrefs: ["/learn"] },
] as const;

// Destinations that are not modules in their own right, so they are not in
// navItems. Everything else takes its label from there rather than repeating it.
const cadenceEntries: Record<string, { label: string; description: string }> = {
  "/inbox": {
    label: "Capture review",
    description: "Transactions read from messages, waiting on your decision.",
  },
  "/month": {
    label: "Month check",
    description: "One pass over the month before you put it to bed.",
  },
  "/import": {
    label: "CSV import",
    description: "Bring in statement rows from CSV.",
  },
  "/settings/rules": {
    label: "Rules & corrections",
    description: "Rules that fill in details for you, and the corrections you have made.",
  },
  "/settings/categories": {
    label: "Categories",
    description: "What each category has cost you, and where duplicates crept in.",
  },
  "/settings": {
    label: "Settings",
    description: "PIN lock, backup, data export, privacy.",
  },
};

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
] as const;

export function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavEntry = { href: string; label: string; description: string };

export function getNavEntry(href: string): NavEntry | undefined {
  const item = navItems.find((entry) => entry.href === href);
  if (item) {
    return { href: item.href, label: item.label, description: item.description };
  }

  const cadence = cadenceEntries[href];
  return cadence ? { href, ...cadence } : undefined;
}

export const groupedHrefs = navGroups.flatMap((group) => [...group.hrefs]);

// A destination already sitting in the bar is not repeated in the menu, so each
// platform hides whatever it shows elsewhere.
export function navGroupsExcluding(shown: readonly string[]) {
  return navGroups
    .map((group) => ({
      title: group.title,
      hrefs: group.hrefs.filter((href) => !shown.includes(href)),
    }))
    .filter((group) => group.hrefs.length > 0);
}

export function getActiveEntryIn(
  pathname: string,
  hrefs: readonly string[],
): NavEntry | undefined {
  const href = hrefs.find((candidate) => isActiveRoute(pathname, candidate));
  return href ? getNavEntry(href) : undefined;
}

export function getActiveGroupedEntry(pathname: string): NavEntry | undefined {
  return getActiveEntryIn(pathname, groupedHrefs);
}

export function MoatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="Moat"
      fill="#ff0000"
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M8.786 9.429a1.071 1.071 0 1 0 0-2.143a1.071 1.071 0 0 0 0 2.143m0 3.428a1.072 1.072 0 1 0 0-2.143a1.072 1.072 0 0 0 0 2.143m7.5-1.071a1.071 1.071 0 1 1-2.143 0a1.071 1.071 0 0 1 2.143 0m-9.214-.643a1.072 1.072 0 1 0 0-2.143a1.072 1.072 0 0 0 0 2.143m7.5-1.072a1.072 1.072 0 1 1-2.144 0a1.072 1.072 0 0 1 2.144 0M10.5 11.143a1.072 1.072 0 1 0 0-2.144a1.072 1.072 0 0 0 0 2.144M18 10.07a1.071 1.071 0 1 1-2.143 0a1.071 1.071 0 0 1 2.143 0m-2.786-.643a1.071 1.071 0 1 0 0-2.142a1.071 1.071 0 0 0 0 2.143M12.857 12a.857.857 0 1 1-1.713 0a.857.857 0 0 1 1.713 0m-2.571 2.571a.857.857 0 1 0 0-1.713a.857.857 0 0 0 0 1.713m9-2.571a.857.857 0 1 1-1.714 0a.857.857 0 0 1 1.714 0m-2.143 2.571a.857.857 0 1 0 0-1.714a.857.857 0 0 0 0 1.714M6.429 12a.857.857 0 1 1-1.714 0a.857.857 0 0 1 1.714 0m-2.572 1.714a.428.428 0 1 0 0-.857a.428.428 0 0 0 0 .857M6 15a.429.429 0 1 1-.857 0A.429.429 0 0 1 6 15m6 .428a.429.429 0 1 0 0-.857a.429.429 0 0 0 0 .857M18.857 15A.429.429 0 1 1 18 15a.429.429 0 0 1 .858 0m1.286-1.286a.428.428 0 1 0 0-.856a.428.428 0 0 0 0 .856m-12.214 0a.857.857 0 1 1-1.715 0a.857.857 0 0 1 1.715 0m5.571.857a.857.857 0 1 0 0-1.713a.857.857 0 0 0 0 1.713" />
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

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="text-[11px] font-medium text-muted-foreground">
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
  description?: string;
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
        className="grid w-full gap-1 rounded-lg px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-3">
          <IconComponent className="h-4 w-4 shrink-0" />
          <span className="text-left">
            <span className="block text-sm font-medium text-foreground">{label}</span>
            {description ? (
              <span className="block text-xs text-muted-foreground">{description}</span>
            ) : null}
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
        <SheetHeader className="px-6 pb-2">
          <SheetTitle>Capture</SheetTitle>
          <SheetDescription className="sr-only">
            Add a transaction. Anything read from a message goes to review first.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-2 overflow-y-auto overscroll-contain px-6">
          {mobileCaptureActions.map((action) => {
            const IconComponent = action.label === "Paste text" ? IconMessage2 : IconPlus;

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
                  className="flex w-full items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-left text-sm font-medium text-foreground"
                >
                  <IconComponent className="h-4 w-4" />
                  {action.label}
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
        <SheetHeader className="px-6 pb-2">
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">
            The rest of Moat, grouped by how often you need it.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-5 overflow-y-auto overscroll-contain px-6 pb-2">
          {navGroupsExcluding(mobilePrimaryNav).map((group) => (
            <DrawerSection key={group.title} title={group.title}>
              <div className="grid">
                {group.hrefs.map((href) => {
                  const item = getNavEntry(href);
                  if (!item) return null;

                  return (
                    <DrawerNavRow
                      key={href}
                      href={href}
                      label={item.label}
                      icon={navIcons[href]}
                      active={isActiveRoute(pathname, href)}
                      onNavigate={close}
                    />
                  );
                })}
              </div>
            </DrawerSection>
          ))}

          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <ThemeToggle onClick={onToggleTheme} className="h-9 w-9" />
          </div>
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
  const activeContextItem = getActiveGroupedEntry(pathname);
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
