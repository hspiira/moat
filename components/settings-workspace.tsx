"use client";

import Link from "next/link";
import {
  IconChevronRight,
  IconDatabaseExport,
  IconLockSquareRounded,
  IconPalette,
  IconRss,
  IconShieldLock,
  IconTags,
  type Icon,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-shell/page-header";
import { SettingsStatus } from "@/components/settings/settings-status";

type SettingsLink = {
  href: string;
  icon: Icon;
  label: string;
  hint: string;
};

// An index, not a tour. Every visit used to scroll past the whole of security,
// storage, backup and data management to reach whichever one it was for.
const GROUPS: { title: string; links: SettingsLink[] }[] = [
  {
    title: "This device",
    links: [
      {
        href: "/settings/security",
        icon: IconShieldLock,
        label: "Security",
        hint: "PIN lock and passkeys",
      },
      {
        href: "/settings/backup",
        icon: IconLockSquareRounded,
        label: "Backup & sync",
        hint: "Where your records live, and taking a copy",
      },
      {
        href: "/settings/appearance",
        icon: IconPalette,
        label: "Appearance",
        hint: "Light, dark, or match the device",
      },
    ],
  },
  {
    title: "How entries are handled",
    links: [
      {
        href: "/settings/capture",
        icon: IconRss,
        label: "Capture",
        hint: "How money messages reach the inbox",
      },
      {
        href: "/settings/categories",
        icon: IconTags,
        label: "Categories",
        hint: "Rename, merge or retire a category",
      },
      {
        href: "/settings/rules",
        icon: IconTags,
        label: "Rules & corrections",
        hint: "Teach the app to make the same fix next time",
      },
    ],
  },
  {
    title: "Everything you have recorded",
    links: [
      {
        href: "/settings/data",
        icon: IconDatabaseExport,
        label: "Data management",
        hint: "Export or delete everything on this device",
      },
    ],
  },
];

function SettingsRow({ href, icon: IconComponent, label, hint }: SettingsLink) {
  return (
    <Link
      href={href}
      className="-mx-4 flex min-w-0 items-center gap-3 border-b border-border px-4 py-3 transition-colors first:border-t hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <IconComponent aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <IconChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function SettingsWorkspace() {
  return (
    <div className="grid min-w-0 gap-8">
      <PageHeader title="Settings" description="Security, privacy and data management." />

      <SettingsStatus />

      {GROUPS.map((group) => (
        <section key={group.title} className="grid min-w-0 gap-2">
          <h2 className="font-display text-base font-semibold">{group.title}</h2>
          <div className="grid">
            {group.links.map((link) => (
              <SettingsRow key={link.href} {...link} />
            ))}
          </div>
        </section>
      ))}

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
