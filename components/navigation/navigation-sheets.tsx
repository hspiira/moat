"use client";

import Link from "next/link";
import { useState } from "react";
import { IconMenu2, IconMessage2, IconPlus, type Icon } from "@tabler/icons-react";

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
        <SheetHeader className="px-5 pb-1">
          <SheetTitle className="text-base">More</SheetTitle>
          <SheetDescription className="sr-only">
            The rest of Moat, grouped by how often you need it.
          </SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 gap-3 overflow-y-auto overscroll-contain px-5 pb-2">
          {navGroupsExcluding(mobilePrimaryNav).map((group) => (
            <DrawerSection key={group.title} title={group.title}>
              <div className="grid grid-cols-2 gap-x-1">
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

