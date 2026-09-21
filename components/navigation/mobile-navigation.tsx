"use client";

import Link from "next/link";
import { IconLock } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { usePinLock } from "@/lib/security/pin-lock-context";
import { navItems } from "@/lib/data";

import {
  getMobileNavLabel,
  isActiveRoute,
  mobilePrimaryNav,
  navIcons,
} from "./navigation-model";
import {
  MoatMark,
} from "./navigation-brand";
import { MobileNavSlotLink } from "./mobile-nav-slot";
import {
  MobileCaptureSheet,
  MobileMoreButton,
} from "./navigation-sheets";

export function MobileNavigation({
  pathname,
  onToggleTheme,
  hasProfile,
}: {
  pathname: string;
  onToggleTheme: () => void;
  hasProfile: boolean;
}) {
  const { hasPinLock, lockState, lock } = usePinLock();

  function renderNavButton(href: (typeof mobilePrimaryNav)[number]) {
    const item = navItems.find((entry) => entry.href === href);
    if (!item) return null;

    return (
      <MobileNavSlotLink
        key={item.href}
        href={item.href}
        label={getMobileNavLabel(item.href)}
        icon={navIcons[item.href]}
        active={isActiveRoute(pathname, item.href)}
      />
    );
  }

  return (
    <>
      {/* Parks below the status bar, not at 0, which would be under the clock. */}
      <header className="sticky top-(--safe-top) z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/90 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <Link
            href="/"
            aria-label="Moat home"
            className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MoatMark className="h-9 w-9" />
          </Link>

          {hasProfile && hasPinLock && lockState.status === "unlocked" ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Lock Moat now"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={lock}
            >
              <IconLock className="h-4.5 w-4.5" />
            </Button>
          ) : null}
        </div>
      </header>

      {hasProfile ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 lg:hidden"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          <nav
            aria-label="Primary"
            className="pointer-events-auto flex w-full max-w-md items-stretch gap-0.5 rounded-[1.75rem] bg-card/80 p-1.5 shadow-lg shadow-black/25 backdrop-blur-xl"
          >
            {mobilePrimaryNav.slice(0, 2).map(renderNavButton)}
            <MobileCaptureSheet />
            {mobilePrimaryNav.slice(2).map(renderNavButton)}
            <MobileMoreButton pathname={pathname} onToggleTheme={onToggleTheme} />
          </nav>
        </div>
      ) : null}
    </>
  );
}
