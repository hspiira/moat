"use client";

import Link from "next/link";
import {
  IconChevronRight,
  IconCloudLock,
  IconDatabaseExport,
  IconLockSquareRounded,
  IconRss,
  IconTags,
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

function SettingsNavRow({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="-mx-4 flex items-center gap-3 border-y border-border px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function SettingsWorkspace() {
  const hasNativeBridge = useHasNativeBridge();
  return (
    <div className="grid gap-8">
      <div className="space-y-1">
        <h1 className="sr-only">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Security, privacy and data management.
        </p>
      </div>

      <SettingsSection
        icon={IconShieldLock}
        title="Security"
        description="Your PIN and keys never leave this device."
      >
        <PinLockPanel />
        <PasskeyPanel />
      </SettingsSection>

      <SettingsSection
        icon={IconTags}
        title="Categories"
        description="What each has cost, and where duplicates crept in."
      >
        <SettingsNavRow
          href="/settings/categories"
          label="Your categories"
          hint="Rename, merge or retire a category"
        />
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
        description="Where your data lives, and how to move it."
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
        description="Export or delete everything on this device."
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
