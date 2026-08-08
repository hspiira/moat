"use client";

import { useHasProfile } from "@/components/hooks/use-has-profile";

/**
 * Reserves the space the fixed mobile capsule sits over.
 *
 * This lives beside the navigation rather than as padding on the app shell so
 * the two appear and disappear together — as shell padding it left a blank
 * gutter under the landing page, on the one screen where a prospect is most
 * likely to read to the bottom.
 */
export function NavBottomSpacer() {
  const profilePresence = useHasProfile();

  if (profilePresence !== "present") {
    return null;
  }

  // 3.5rem of capsule plus a rem of breathing room, above whichever is larger
  // of the home-indicator inset or 0.625rem.
  return (
    <div
      aria-hidden="true"
      className="h-[calc(4.5rem+max(0.625rem,env(safe-area-inset-bottom)))] lg:hidden"
    />
  );
}
