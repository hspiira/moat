"use client";

import { useHasNativeBridge, useIsIosApp } from "@/components/hooks/use-native-bridge";

import { CaptureAutomationPanel } from "./capture-automation-panel";
import { CaptureShortcutPanel } from "./capture-shortcut-panel";
import { SettingsDetailShell } from "./settings-detail-shell";

export function CaptureSettingsWorkspace() {
  const hasNativeBridge = useHasNativeBridge();
  const isIos = useIsIosApp();
  const hasAutomation = hasNativeBridge || isIos;

  return (
    <SettingsDetailShell
      title="Capture"
      description="How money messages reach Moat. Anything read from a message goes to the capture inbox before it counts."
    >
      {hasNativeBridge ? <CaptureAutomationPanel /> : null}
      {isIos ? <CaptureShortcutPanel /> : null}
      {hasAutomation ? null : (
        <p className="text-sm text-muted-foreground">
          Automatic capture needs the Moat app on a phone. In a browser, paste a message
          into the Add sheet instead.
        </p>
      )}
    </SettingsDetailShell>
  );
}
