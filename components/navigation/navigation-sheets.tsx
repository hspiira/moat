"use client";

import Link from "next/link";
import { useState } from "react";
import {
  IconFileImport,
  IconMenu2,
  IconMessage2,
  IconPlus,
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
import {
  getActiveGroupedEntry,
  getNavEntry,
  isActiveRoute,
  mobileCaptureActions,
  mobilePrimaryNav,
  navGroupsExcluding,
  navIcons,
} from "@/components/navigation/navigation-model";
import { ThemeToggle } from "@/components/navigation/navigation-brand";
import {
  mobileNavLabelClass,
  mobileNavSlotClass,
  mobileNavToneClass,
} from "@/components/navigation/mobile-nav-slot";

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-1.5">
      <div className="px-1 text-[11px] font-medium text-muted-foreground">
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
        className="grid w-full gap-1 rounded-lg px-2.5 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <IconComponent className="h-4 w-4 shrink-0" />
          <span className="min-w-0 text-left">
            <span className="block text-sm leading-tight font-medium text-foreground">{label}</span>
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
          variant="ghost"
          aria-label="Add a transaction"
          className={`${mobileNavSlotClass} text-foreground shadow-none hover:bg-transparent`}
        >
          {/* The one control in the bar that acts rather than navigates, so it
              keeps the filled disc that set it apart before. */}
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <IconPlus className="size-4.5" />
          </span>
          <span className={mobileNavLabelClass}>Add</span>
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
            const IconComponent = action.secondary
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
                  className={
                    action.secondary
                      ? "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                      : "flex w-full items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 text-left text-sm font-medium text-foreground"
                  }
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
        <SheetHeader className="px-5 pb-1">
          <SheetTitle className="text-base">More</SheetTitle>
          <SheetDescription className="sr-only">
            The rest of Moat, grouped by how often you need it.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-3 overflow-y-auto overscroll-contain px-5 pb-2">
          {navGroupsExcluding(mobilePrimaryNav).map((group) => (
            <DrawerSection key={group.title} title={group.title}>
              <div className="grid gap-0.5">
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

          <div className="flex items-center justify-between gap-3 px-2.5 py-1">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <ThemeToggle onClick={onToggleTheme} className="h-9 w-9" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MobileMoreButton({
  pathname,
  onToggleTheme,
}: {
  pathname: string;
  onToggleTheme: () => void;
}) {
  // The button opens the whole menu, so it is called More on every page. It
  // still lights up when you are inside the menu, and the menu marks which row
  // you are on, but it never borrows a destination's name for a control that
  // does not go there.
  const activeContextItem = getActiveGroupedEntry(pathname);
  const isActive = Boolean(activeContextItem);

  return (
    <MobileUtilitySheet
      pathname={pathname}
      onToggleTheme={onToggleTheme}
      trigger={
        <Button
          variant="ghost"
          aria-label={
            activeContextItem ? `More. Currently on ${activeContextItem.label}` : "More"
          }
          className={`${mobileNavSlotClass} ${mobileNavToneClass(isActive)} shadow-none`}
        >
          <IconMenu2 className="size-5 shrink-0" stroke={isActive ? 2 : 1.7} />
          <span className={mobileNavLabelClass}>More</span>
        </Button>
      }
    />
  );
}

