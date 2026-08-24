"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconShare, IconSquareRoundedPlus, IconX } from "@tabler/icons-react";

import { getLocalSaveEventName, type LocalSaveDetail } from "@/lib/local-save";
import { useHasProfile } from "@/components/hooks/use-has-profile";
import { readGoogleDriveBackupPreferences } from "@/lib/preferences/google-drive-backup";
import {
  readBackupStaleness,
  type BackupStaleness,
} from "@/lib/domain/backup-staleness";
import {
  ensurePersistentStorage,
  isEvictable,
  isRunningLowOnSpace,
  type StorageDurability,
} from "@/lib/storage-durability";
import {
  dismissStorageNotice,
  isStorageNoticeDismissed,
  type StorageNoticeKind,
} from "@/lib/preferences/storage-notice";
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
    "Capacitor" in window ||
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

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
  const [staleness, setStaleness] = useState<BackupStaleness | null>(null);
  const profilePresence = useHasProfile();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [lastLocalSave, setLastLocalSave] = useState<LocalSaveDetail | null>(null);
  const [durability, setDurability] = useState<StorageDurability | null>(null);
  const [dismissed, setDismissed] = useState<StorageNoticeKind[]>([]);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    setIsInstalled(isStandaloneDisplay());
    setIsIos(isIosDevice());
    const { lastBackupAt } = readGoogleDriveBackupPreferences();
    setHasBackup(Boolean(lastBackupAt));
    setStaleness(readBackupStaleness(lastBackupAt, new Date()));
    void ensurePersistentStorage().then(setDurability);
    setDismissed(
      (["evictable", "low-space", "no-backup", "stale-backup"] as const).filter(
        isStorageNoticeDismissed,
      ),
    );

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
  const hasProfile = profilePresence === "present";
  const shouldShowBackupNudge = isIos && !hasBackup && hasProfile;

  const isAtRisk = Boolean(durability && isEvictable(durability)) && hasProfile && !hasBackup;
  const isLowOnSpace = Boolean(durability && isRunningLowOnSpace(durability)) && hasProfile;
  const staleBackupNotice: { kind: StorageNoticeKind; text: string } | null =
    hasProfile && staleness?.state === "stale"
      ? {
          kind: "stale-backup",
          text: `Your last backup was ${staleness.days} days ago.`,
        }
      : null;

  const notice: { kind: StorageNoticeKind; text: string } | null = isLowOnSpace
    ? {
        kind: "low-space",
        text: "Device storage is nearly full, which is when a browser starts clearing app data.",
      }
    : isAtRisk
      ? {
          kind: "evictable",
          text: "This device has not promised to keep your records, so it may clear them to free space.",
        }
      : shouldShowBackupNudge
        ? {
            kind: "no-backup",
            text: "No backup yet, and iOS can clear app storage under low disk space.",
          }
        : staleBackupNotice;

  const storageWarning = notice && !dismissed.includes(notice.kind) ? notice : null;

  function dismiss(kind: StorageNoticeKind) {
    dismissStorageNotice(kind);
    setDismissed((current) => [...current, kind]);
  }

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
          <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <span>
              {storageWarning.text}{" "}
              <Link href="/settings" className="text-foreground underline underline-offset-2">
                Back up now
              </Link>
            </span>
            <button
              type="button"
              aria-label="Dismiss storage warning"
              className="-mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => dismiss(storageWarning.kind)}
            >
              <IconX className="size-3.5" />
            </button>
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
