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
        description="Protect your data on shared devices. Keys are derived in-browser with Argon2id and never sent anywhere."
      >
        <PinLockPanel />
        <PasskeyPanel />
      </SettingsSection>

      <SettingsSection
        icon={IconRss}
        title="Capture automation"
        description="Control native capture channels and allowlisted sources before machine-derived records are sent into review."
      >
        <CaptureAutomationPanel />
      </SettingsSection>

      <SettingsSection
        icon={IconCloudLock}
        title="Storage and sync"
        description="Moat always writes locally first. Hosted sync is optional and remains an explicit opt-in mode."
      >
        <SyncModePanel />
      </SettingsSection>

      <SettingsSection
        icon={IconLockSquareRounded}
        title="Backup and restore"
        description="Your data is stored locally only. A device reset or browser clear will delete it. Download an encrypted backup regularly or keep a recovery copy in Google Drive."
      >
        <BackupPanel />
      </SettingsSection>

      <SettingsSection
        icon={IconDatabaseExport}
        title="Your data"
        description="Export or delete all data stored on this device. These rights are guaranteed under the Uganda Data Protection and Privacy Act 2019."
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
          All data is stored locally on your device and never transmitted to any server.
        </div>
      </section>
    </div>
  );
}
