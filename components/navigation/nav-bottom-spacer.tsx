"use client";

import { useHasProfile } from "@/components/hooks/use-has-profile";

export function NavBottomSpacer() {
  const profilePresence = useHasProfile();

  if (profilePresence !== "present") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="h-[calc(4.5rem+max(0.625rem,env(safe-area-inset-bottom)))] lg:hidden"
    />
  );
}
