"use client";

import Link from "next/link";

import { BackupPanel } from "./settings/backup-panel";
import { CaptureAutomationPanel } from "./settings/capture-automation-panel";
import { DataExportPanel } from "./settings/data-export-panel";
import { DeleteAccountPanel } from "./settings/delete-account-panel";
import { PinLockPanel } from "./settings/pin-lock-panel";

export function SettingsWorkspace() {
  return (
    <div className="grid gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Security, privacy, and data management for your Moat account.
        </p>
      </div>

      <section className="grid gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Security</h2>
          <p className="text-xs text-muted-foreground">
            Protect your data on shared devices. Keys are derived in-browser using PBKDF2 and
            never sent anywhere.
          </p>
        </div>
        <PinLockPanel />
      </section>

      <section className="grid gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Capture automation</h2>
          <p className="text-xs text-muted-foreground">
            Control native capture channels and allowlisted sources before machine-derived records
            are sent into review.
          </p>
        </div>
        <CaptureAutomationPanel />
      </section>

      <section className="grid gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Backup and restore</h2>
          <p className="text-xs text-muted-foreground">
            Your data is stored locally only. A device reset or browser clear will delete it.
            Download an encrypted backup regularly.
          </p>
        </div>
        <BackupPanel />
      </section>

      <section className="grid gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Your data</h2>
          <p className="text-xs text-muted-foreground">
            Export or delete all data stored on this device. These rights are guaranteed under
            the Uganda Data Protection and Privacy Act 2019.
          </p>
        </div>
        <DataExportPanel />
        <DeleteAccountPanel />
      </section>

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
