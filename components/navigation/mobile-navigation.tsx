"use client";

import Link from "next/link";
import { IconLock } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { usePinLock } from "@/lib/security/pin-lock-context";
import { navItems } from "@/lib/data";

import {
  isActiveRoute,
  MobileCaptureSheet,
  mobilePrimaryNav,
  MobileMoreButton,
  MobileNavTrigger,
  MoatMark,
  navIcons,
} from "./navigation-shared";

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

  // The active tab is a labelled pill and capture is a wordless circle. Both are
  // filled with --primary, so shape is the only thing telling them apart.
  function renderNavButton(href: (typeof mobilePrimaryNav)[number]) {
    const item = navItems.find((entry) => entry.href === href);
    if (!item) return null;

    const isActive = isActiveRoute(pathname, item.href);
    const IconComponent = navIcons[item.href];

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={[
          "flex h-11 items-center justify-center gap-2 rounded-full px-3",
          "transition-[background-color,color,padding] duration-200 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          isActive
            ? "bg-primary pr-4 pl-3.5 text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <IconComponent className="size-5 shrink-0" stroke={isActive ? 2 : 1.7} />
        {isActive ? (
          <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
        ) : (
          <span className="sr-only">{item.label}</span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* The brand bar stays whether or not a profile exists — it is the only
          thing telling a first-time visitor whose app this is. The menu trigger
          beside it is suppressed pre-profile, since everything it opens is a
          setup-required screen. */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <MoatMark className="h-9 w-9 shrink-0" />

          {hasProfile ? (
            <div className="flex shrink-0 items-center gap-1">
              {hasPinLock && lockState.status === "unlocked" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Lock Moat now"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={lock}
                >
                  <IconLock className="h-4.5 w-4.5" />
                </Button>
              ) : null}
              <MobileNavTrigger pathname={pathname} onToggleTheme={onToggleTheme} />
            </div>
          ) : null}
        </div>

      </div>

      {/* pointer-events-none on the positioning layer keeps the gutters either
          side of the capsule tappable by the page beneath. */}
      {hasProfile ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 lg:hidden"
          // The home-indicator inset is already a gap. Adding a full rem on top
          // of it floated the capsule halfway up the screen on iOS.
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          <nav
            aria-label="Primary"
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-card/80 p-1.5 shadow-lg shadow-black/25 backdrop-blur-xl"
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
