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

  if (profilePresence === "resolving") {
    return null;
  }

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
