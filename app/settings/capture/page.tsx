import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CaptureSettingsWorkspace } from "@/components/settings/capture-settings-workspace";

export const metadata: Metadata = {
  title: "Capture | Moat",
};

export default function CaptureSettingsPage() {
  return (
    <AppShell>
      <CaptureSettingsWorkspace />
    </AppShell>
  );
}
