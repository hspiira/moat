import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { DataSettingsWorkspace } from "@/components/settings/data-settings-workspace";

export const metadata: Metadata = {
  title: "Data management | Moat",
};

export default function DataSettingsPage() {
  return (
    <AppShell>
      <DataSettingsWorkspace />
    </AppShell>
  );
}
