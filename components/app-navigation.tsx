"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { DesktopNavigation } from "@/components/navigation/desktop-navigation";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";

export function AppNavigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <>
      <MobileNavigation pathname={pathname} onToggleTheme={toggleTheme} />
      <DesktopNavigation pathname={pathname} onToggleTheme={toggleTheme} />
    </>
  );
}
