"use client";

import { startTransition, useEffect, useState } from "react";

import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { HomeOverview } from "@/components/home-overview";
import { modulePreviews } from "@/lib/data";
import { repositories } from "@/lib/repositories/instance";
import type { UserProfile } from "@/lib/types";

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
