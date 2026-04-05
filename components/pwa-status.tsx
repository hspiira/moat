"use client";

import { useEffect, useState } from "react";

import { getLocalSaveEventName, type LocalSaveDetail } from "@/lib/local-save";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [lastLocalSave, setLastLocalSave] = useState<LocalSaveDetail | null>(null);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    setIsInstalled(isStandaloneDisplay());

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
    }

    function handleLocalSave(event: Event) {
      setLastLocalSave((event as CustomEvent<LocalSaveDetail>).detail);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener(getLocalSaveEventName(), handleLocalSave as EventListener);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener(getLocalSaveEventName(), handleLocalSave as EventListener);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }

      setInstallPrompt(null);
    } finally {
      setIsInstalling(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isOnline ? "outline" : "secondary"}>
          {isOnline ? "Online" : "Offline mode"}
        </Badge>
        <Badge variant="outline">Saved locally</Badge>
        {isInstalled ? <Badge variant="outline">Installed</Badge> : null}
        {lastLocalSave ? (
          <span className="text-xs text-muted-foreground">{lastLocalSave.message}</span>
        ) : null}
      </div>

      {installPrompt && !isInstalled ? (
        <Button size="sm" variant="outline" onClick={() => void handleInstall()}>
          {isInstalling ? "Installing..." : "Install app"}
        </Button>
      ) : null}
    </div>
  );
}
