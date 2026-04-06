import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SyncConflictsWorkspace } from "@/components/sync-conflicts-workspace";

export const metadata: Metadata = {
  title: "Sync conflicts — Moat",
};

export default function SyncConflictsPage() {
  return (
    <AppShell>
      <SyncConflictsWorkspace />
    </AppShell>
  );
}

