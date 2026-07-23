"use client";

import Link from "next/link";
import {
  IconCloudLock,
  IconDatabaseExport,
  IconLockSquareRounded,
  IconRss,
  IconShieldLock,
  type Icon,
} from "@tabler/icons-react";

import { useHasNativeBridge } from "@/components/hooks/use-native-bridge";
import { BackupPanel } from "./settings/backup-panel";
import { CaptureAutomationPanel } from "./settings/capture-automation-panel";
import { DataExportPanel } from "./settings/data-export-panel";
import { DeleteAccountPanel } from "./settings/delete-account-panel";
import { PasskeyPanel } from "./settings/passkey-panel";
import { PinLockPanel } from "./settings/pin-lock-panel";
import { SyncModePanel } from "./settings/sync-mode-panel";

function SettingsSection({
  icon: IconComponent,
  title,
  description,
  children,
}: {
  icon: Icon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
        >
          <IconComponent className="size-4.5" />
        </span>
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsWorkspace() {
  const hasNativeBridge = useHasNativeBridge();
  return (
    <div className="grid gap-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Security, privacy, and data management for your Moat account.
        </p>
      </div>

      <SettingsSection
        icon={IconShieldLock}
        title="Security"
        description="Protect your data on shared devices. Your PIN and keys stay on this device and are never sent anywhere."
      >
        <PinLockPanel />
        <PasskeyPanel />
      </SettingsSection>

      {hasNativeBridge ? (
        <SettingsSection
          icon={IconRss}
          title="Capture automation"
          description="Let Moat pick up money messages from your phone and send them to review before they post."
        >
          <CaptureAutomationPanel />
        </SettingsSection>
      ) : null}

      <SettingsSection
        icon={IconCloudLock}
        title="Storage"
        description="Where your data lives and how to move it between devices."
      >
        <SyncModePanel />
      </SettingsSection>

      <SettingsSection
        icon={IconLockSquareRounded}
        title="Backup and restore"
        description="Your data lives on this device, so a device reset or browser clear erases it. Download an encrypted backup regularly and keep it somewhere safe."
      >
        <BackupPanel />
      </SettingsSection>

      <SettingsSection
        icon={IconDatabaseExport}
        title="Your data"
        description="Export or delete everything stored on this device. See the Privacy Policy for your rights."
      >
        <DataExportPanel />
        <DeleteAccountPanel />
      </SettingsSection>

      <section className="grid gap-2">
        <div className="text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          {" · "}
          Your data stays on this device unless you turn on cloud backup or sync.
        </div>
      </section>
    </div>
  );
}
