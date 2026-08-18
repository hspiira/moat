"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconShare, IconSquareRoundedPlus } from "@tabler/icons-react";

import { getLocalSaveEventName, type LocalSaveDetail } from "@/lib/local-save";
import { useHasProfile } from "@/components/hooks/use-has-profile";
import { readGoogleDriveBackupPreferences } from "@/lib/preferences/google-drive-backup";
import {
  ensurePersistentStorage,
  isEvictable,
  isRunningLowOnSpace,
  type StorageDurability,
} from "@/lib/storage-durability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

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

// iOS Safari never fires beforeinstallprompt, so the only way to detect an
// installable iOS session is by platform sniffing. iPadOS 13+ reports as
// "MacIntel" with touch support, which is what the maxTouchPoints check
// disambiguates from an actual Mac.
function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [hasBackup, setHasBackup] = useState(true);
  const profilePresence = useHasProfile();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [lastLocalSave, setLastLocalSave] = useState<LocalSaveDetail | null>(null);
  const [durability, setDurability] = useState<StorageDurability | null>(null);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    setIsInstalled(isStandaloneDisplay());
    setIsIos(isIosDevice());
    setHasBackup(Boolean(readGoogleDriveBackupPreferences().lastBackupAt));
    // Asks the browser to exempt the ledger from eviction. Declining is normal
    // and not an error; it only means a backup matters more.
    void ensurePersistentStorage().then(setDurability);

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

  const shouldShowInstall = Boolean(installPrompt) && !isInstalled;
  const shouldShowIosInstall = isIos && !isInstalled && !installPrompt;
  // iOS aggressively evicts PWA storage under disk pressure, so an unbacked-up
  // device risks silent data loss in a way Android doesn't. Surface this
  // everywhere, not just in settings.
  // Nothing to lose yet, so nothing to warn about. Telling a prospect their
  // records could be cleared before they have any reads as a broken app.
  const hasProfile = profilePresence === "present";
  const shouldShowBackupNudge = isIos && !hasBackup && hasProfile;

  // The browser may clear an evictable origin without asking. That was already
  // true on iOS and warned about there; it is true on Chromium and Firefox too
  // whenever the persist request was refused.
  const isAtRisk = Boolean(durability && isEvictable(durability)) && hasProfile && !hasBackup;
  const isLowOnSpace = Boolean(durability && isRunningLowOnSpace(durability)) && hasProfile;

  // One message, most urgent first. The iOS line is a fallback for a browser
  // that does not report a storage state at all.
  const storageWarning = isLowOnSpace
    ? "Device storage is nearly full, which is when a browser starts clearing app data."
    : isAtRisk
      ? "This browser has not promised to keep your records, so it may clear them to free space."
      : shouldShowBackupNudge
        ? "No backup yet, and iOS can clear app storage under low disk space."
        : null;

  const shouldShowStatus =
    !isOnline ||
    !isInstalled ||
    lastLocalSave !== null ||
    shouldShowInstall ||
    shouldShowIosInstall ||
    storageWarning !== null;

  if (!shouldShowStatus) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isOnline ? <Badge variant="secondary">Offline mode</Badge> : null}
        {!isInstalled && hasProfile ? <Badge variant="outline">Saved locally</Badge> : null}
        {lastLocalSave ? (
          <span className="text-xs text-muted-foreground">{lastLocalSave.message}</span>
        ) : null}
        {storageWarning ? (
          <span className="text-xs text-muted-foreground">
            {storageWarning}{" "}
            <Link href="/settings" className="text-foreground underline underline-offset-2">
              Back up now
            </Link>
          </span>
        ) : null}
      </div>

      {shouldShowInstall ? (
        <Button size="sm" variant="outline" onClick={() => void handleInstall()}>
          {isInstalling ? "Installing..." : "Install app"}
        </Button>
      ) : null}

      {shouldShowIosInstall ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              Install app
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end">
            <PopoverTitle>Add Moat to your Home Screen</PopoverTitle>
            <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <IconShare className="size-4 shrink-0 text-foreground" />
                Tap the Share icon in Safari&apos;s toolbar
              </li>
              <li className="flex items-center gap-2">
                <IconSquareRoundedPlus className="size-4 shrink-0 text-foreground" />
                Scroll down and tap &quot;Add to Home Screen&quot;
              </li>
            </ol>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
