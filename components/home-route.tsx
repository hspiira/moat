"use client";

import { startTransition, useEffect, useState } from "react";

import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { HomeOverview } from "@/components/home-overview";
import { modulePreviews } from "@/lib/data";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { UserProfile } from "@/lib/types";

const repositories = createIndexedDbRepositories();

/**
 * Selects and renders the appropriate top-level home route UI based on the persisted user profile.
 *
 * @returns The dashboard workspace when a user profile exists; the home overview when no profile is found; `null` while the profile lookup is in progress.
 */
export function HomeRoute() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    startTransition(() => {
      void repositories.userProfile
        .get()
        .then((nextProfile) => setProfile(nextProfile))
        .catch(() => setProfile(null))
        .finally(() => setIsResolved(true));
    });
  }, []);

  if (!isResolved) {
    return null;
  }

  if (profile) {
    return <DashboardWorkspace profile={profile} />;
  }

  return <HomeOverview modulePreviews={modulePreviews} />;
}
