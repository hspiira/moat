"use client";

import { useEffect, useState } from "react";

import {
  defaultCaptureAutomationSettings,
  loadCaptureAutomationSettings,
  notificationAllowlistCatalog,
  saveCaptureAutomationSettings,
  type CaptureAutomationSettings,
} from "@/lib/native/capture-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function NotificationSourceRow({
  checked,
  label,
  packageName,
  onToggle,
}: {
  checked: boolean;
  label: string;
  packageName: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between gap-3 border border-border/20 px-3 py-3 text-left"
    >
      <div className="grid gap-0.5">
        <div className="text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{packageName}</div>
      </div>
      <div className={checked ? "text-primary dark:text-cyan-300" : "text-muted-foreground"}>
        {checked ? "Allowed" : "Blocked"}
      </div>
    </button>
  );
}

export function CaptureAutomationPanel() {
  const [settings, setSettings] = useState<CaptureAutomationSettings>(defaultCaptureAutomationSettings);

  useEffect(() => {
    setSettings(loadCaptureAutomationSettings());
  }, []);

  function updateSettings(next: CaptureAutomationSettings) {
    setSettings(next);
    saveCaptureAutomationSettings(next);
  }

  return (
    <Card className="border-border/20 shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Capture automation</div>
          <div className="text-sm text-muted-foreground">
            Native Android notification capture is gated by an explicit allowlist and still routes
            everything into review before posting.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={settings.notificationCaptureEnabled ? "default" : "outline"}
            onClick={() =>
              updateSettings({
                ...settings,
                notificationCaptureEnabled: !settings.notificationCaptureEnabled,
              })
            }
          >
            {settings.notificationCaptureEnabled ? "Notification capture enabled" : "Notification capture disabled"}
          </Button>
        </div>

        <div className="grid gap-2">
          {notificationAllowlistCatalog.map((entry) => {
            const checked = settings.allowedNotificationPackages.includes(entry.packageName);

            return (
              <NotificationSourceRow
                key={entry.id}
                checked={checked}
                label={entry.label}
                packageName={entry.packageName}
                onToggle={() =>
                  updateSettings({
                    ...settings,
                    allowedNotificationPackages: checked
                      ? settings.allowedNotificationPackages.filter((value) => value !== entry.packageName)
                      : [...settings.allowedNotificationPackages, entry.packageName],
                  })
                }
              />
            );
          })}
        </div>

        <div className="grid gap-1 text-xs text-muted-foreground">
          <div>Native bridge contract: `window.moatNativeCapture.ingest(payload)`</div>
          <div>
            Android host shell work remains required before this becomes a live device-level
            capture path.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
