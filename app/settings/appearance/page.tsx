import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AppearanceSettingsWorkspace } from "@/components/settings/appearance-settings-workspace";

export const metadata: Metadata = {
  title: "Appearance | Moat",
};

export default function AppearanceSettingsPage() {
  return (
    <AppShell>
      <AppearanceSettingsWorkspace />
    </AppShell>
  );
}
