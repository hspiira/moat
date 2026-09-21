"use client";

import { BackupPanel } from "./backup-panel";
import { SettingsDetailShell } from "./settings-detail-shell";
import { SyncModePanel } from "./sync-mode-panel";

export function BackupSettingsWorkspace() {
  return (
    <SettingsDetailShell
      title="Backup & sync"
      description="Your data lives on this device, so a device reset or browser clear erases it. Download an encrypted backup regularly and keep it somewhere safe."
    >
      <SyncModePanel />
      <BackupPanel />
    </SettingsDetailShell>
  );
}
