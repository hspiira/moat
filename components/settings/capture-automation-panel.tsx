"use client";

import { useState } from "react";

import {
  defaultCaptureAutomationSettings,
  loadCaptureAutomationSettings,
  notificationAllowlistCatalog,
  saveCaptureAutomationSettings,
  type CaptureAutomationSettings,
} from "@/lib/native/capture-settings";
import { syncNativeCaptureSettings } from "@/lib/native/capture-bridge";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
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
  const { show } = useToast();
  const [settings, setSettings] = useState<CaptureAutomationSettings>(() => {
    if (typeof window === "undefined") {
      return defaultCaptureAutomationSettings;
    }
    return loadCaptureAutomationSettings();
  });

  function updateSettings(next: CaptureAutomationSettings) {
    const previous = settings;
    setSettings(next);
    try {
      saveCaptureAutomationSettings(next);
      syncNativeCaptureSettings(JSON.stringify(next));
    } catch (error) {
      // Roll back the optimistic change so the UI matches what was actually saved.
      setSettings(previous);
      show(errorMessage(error, "Couldn't update capture settings."), "error");
    }
  }

  return (
    <Card className="border-border/20 shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Read money messages automatically</div>
          <div className="text-sm text-muted-foreground">
            When on, Moat reads new money messages from the apps you allow below and sends them to
            review — nothing posts to your ledger without your say-so.
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
            {settings.notificationCaptureEnabled ? "Automatic reading is on" : "Automatic reading is off"}
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

        <p className="text-xs text-muted-foreground">
          You can also share a message to Moat from another app to bring it in for review.
        </p>
      </CardContent>
    </Card>
  );
}
