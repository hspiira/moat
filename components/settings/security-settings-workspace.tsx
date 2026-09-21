"use client";

import { PasskeyPanel } from "./passkey-panel";
import { PinLockPanel } from "./pin-lock-panel";
import { SettingsDetailShell } from "./settings-detail-shell";

export function SecuritySettingsWorkspace() {
  return (
    <SettingsDetailShell
      title="Security"
      description="Your PIN and keys never leave this device."
    >
      <PinLockPanel />
      <PasskeyPanel />
    </SettingsDetailShell>
  );
}
