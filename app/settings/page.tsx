import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { SettingsWorkspace } from "@/components/settings-workspace";

export const metadata: Metadata = {
  title: "Settings — Moat",
};

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsWorkspace />
    </AppShell>
  );
}
