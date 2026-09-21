import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SecuritySettingsWorkspace } from "@/components/settings/security-settings-workspace";

export const metadata: Metadata = {
  title: "Security | Moat",
};

export default function SecuritySettingsPage() {
  return (
    <AppShell>
      <SecuritySettingsWorkspace />
    </AppShell>
  );
}
