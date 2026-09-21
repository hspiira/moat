import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { BackupSettingsWorkspace } from "@/components/settings/backup-settings-workspace";

export const metadata: Metadata = {
  title: "Backup & sync | Moat",
};

export default function BackupSettingsPage() {
  return (
    <AppShell>
      <BackupSettingsWorkspace />
    </AppShell>
  );
}
