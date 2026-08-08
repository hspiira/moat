"use client";

import { startTransition, useEffect, useState } from "react";

import { repositories } from "@/lib/repositories/instance";

export type ProfilePresence = "resolving" | "present" | "absent";

/**
 * Whether this device has a profile yet.
 *
 * Returns "resolving" rather than defaulting to absent so callers can render
 * nothing on the first pass. Guessing either way produces a visible flash:
 * assume present and the navigation appears then vanishes for a prospect;
 * assume absent and it pops in for an existing user on every load.
 */
export function useHasProfile(): ProfilePresence {
  const [presence, setPresence] = useState<ProfilePresence>("resolving");

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      void repositories.userProfile
        .get()
        .then((profile) => {
          if (!cancelled) {
            setPresence(profile ? "present" : "absent");
          }
        })
        .catch(() => {
          // A read failure is not evidence the profile is missing, and hiding
          // navigation would strand someone who does have data. Fail toward
          // keeping the app usable.
          if (!cancelled) {
            setPresence("present");
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return presence;
}
