"use client";

import { startTransition, useEffect, useState } from "react";

import { repositories } from "@/lib/repositories/instance";

export type ProfilePresence = "resolving" | "present" | "absent";

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
