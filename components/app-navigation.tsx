"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { useHasProfile } from "@/components/hooks/use-has-profile";
import { DesktopNavigation } from "@/components/navigation/desktop-navigation";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const profilePresence = useHasProfile();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  // Nothing at all until the read settles, so neither state flashes.
  if (profilePresence === "resolving") {
    return null;
  }

  // Before a profile exists every destination is a SetupRequiredCard, so the
  // tab bar offered a prospect five ways to reach "Nothing here yet". Mobile
  // keeps its brand bar — the only thing naming the app for a first-time
  // visitor — and drops the tabs. Desktop navigation is entirely links, so it
  // goes altogether.
  const hasProfile = profilePresence === "present";

  return (
    <>
      <MobileNavigation
        pathname={pathname}
        onToggleTheme={toggleTheme}
        hasProfile={hasProfile}
      />
      {hasProfile ? (
        <DesktopNavigation pathname={pathname} onToggleTheme={toggleTheme} />
      ) : null}
    </>
  );
}
