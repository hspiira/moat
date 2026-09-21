"use client";

import { DataExportPanel } from "./data-export-panel";
import { DeleteAccountPanel } from "./delete-account-panel";
import { SettingsDetailShell } from "./settings-detail-shell";

// Deleting everything lives here rather than on the index, so reaching it is
// a deliberate act rather than something you scroll past.
export function DataSettingsWorkspace() {
  return (
    <SettingsDetailShell
      title="Data management"
      description="Export or delete everything on this device."
    >
      <DataExportPanel />
      <DeleteAccountPanel />
    </SettingsDetailShell>
  );
}
