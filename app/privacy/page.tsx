import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft, IconDownload, IconLock, IconTrash } from "@tabler/icons-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Privacy Policy — Moat",
  description: "How Moat collects, stores, and protects your financial data.",
};

const LAST_UPDATED = "06-04-2026";
const CONTACT_EMAIL = "privacy@moat.local";

const sections = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <>
        <p>
          Moat is a personal finance application designed for individuals and households in
          Uganda. For privacy enquiries, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "What data we collect",
    content: (
      <>
        <p>Moat only stores the financial data you put into the app or deliberately import.</p>
        <ul className="grid gap-2 text-foreground/80">
          <li>Your display name and profile preferences</li>
          <li>Account names, types, and balances you record</li>
          <li>Transactions, budgets, goals, and planning settings</li>
          <li>Imported files such as CSV statements or captured message text you submit for review</li>
        </ul>
        <p>
          Moat does not include analytics SDKs, ad trackers, or third-party profiling tools.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    title: "How your data is stored",
    content: (
      <>
        <p>
          Moat is local-first. Your records are stored in your device&apos;s IndexedDB storage.
          They do not leave your device unless you explicitly export or share them.
        </p>
        <p>
          Clearing browser storage or uninstalling the app removes local records unless you have
          created a backup.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Encryption and security",
    content: (
      <>
        <p>
          Moat offers optional PIN lock and encrypted backup features. When enabled, the app uses
          your PIN to derive an encryption key and protect local access.
        </p>
        <ul className="grid gap-2 text-foreground/80">
          <li>The app can require a PIN to unlock on each session</li>
          <li>Encrypted backup files are protected with AES-GCM</li>
          <li>Derived keys are kept only for the active session and cleared on lock</li>
        </ul>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights under the Uganda Data Protection and Privacy Act 2019",
    content: (
      <>
        <p>
          Because Moat stores your data locally, most data rights can be exercised directly in the
          app.
        </p>
        <ul className="grid gap-2 text-foreground/80">
          <li>Access: export your data from Settings</li>
          <li>Correction: edit accounts, transactions, and goals directly in the app</li>
          <li>Portability: download your records in structured export format</li>
          <li>Erasure: delete your stored data from Settings</li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    title: "Data retention",
    content: (
      <>
        <p>
          Data stays on your device until you delete it. Moat does not apply automatic expiry or
          silent deletion to your accounting records.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third parties and external requests",
    content: (
      <>
        <p>
          Moat does not share your financial records with third parties. Imported files and
          captured messages are processed locally in the app.
        </p>
        <p>
          The application may load framework-managed assets such as fonts, but it does not send
          your accounting records to outside services during normal use.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <>
        <p>
          This policy is updated when Moat&apos;s data handling changes. The last updated date at the
          top of this page reflects the latest revision.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <>
        <p>
          For privacy questions or data requests, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
] as const;

function PrivacySummaryCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardContent className="grid gap-2 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0 text-primary dark:text-cyan-300" />
          <div className="text-sm font-medium text-foreground">{title}</div>
        </div>
        <div className="text-sm leading-6 text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}

function PrivacySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="grid gap-1.5 text-sm leading-[1.55] text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="grid gap-5">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <IconArrowLeft className="h-4 w-4" />
              Back to settings
            </Link>
          </Button>
        </div>

        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            How Moat handles your financial records, local storage, and privacy rights while keeping
            the experience inside the app.
          </p>
        </div>

        <Card className="border-border/20 shadow-none">
          <CardContent className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Last updated
              </div>
              <div className="text-sm text-foreground">{LAST_UPDATED}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <PrivacySummaryCard
                icon={IconLock}
                title="Local-first by default"
                body="Your records stay on your device unless you explicitly export or share them."
              />
              <PrivacySummaryCard
                icon={IconDownload}
                title="Portable"
                body="You can export your data from Settings whenever you need a copy."
              />
              <PrivacySummaryCard
                icon={IconTrash}
                title="You stay in control"
                body="You can correct or delete your records directly inside the app."
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <Card className="border-border/20 shadow-none lg:sticky lg:top-24">
            <CardContent className="grid gap-3 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                On this page
              </div>
              <nav className="grid gap-1">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    asChild
                    variant="ghost"
                    className="h-auto justify-start px-2 py-2 text-left text-sm whitespace-normal"
                  >
                    <a href={`#${section.id}`} className="block w-full break-words leading-5">
                      {section.title}
                    </a>
                  </Button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <Card className="border-border/20 shadow-none">
            <CardContent className="grid gap-4 p-4 sm:p-5">
              <div className="grid gap-1.5 text-sm leading-[1.55] text-muted-foreground">
                <p>
                  Moat is a local-first personal finance application. No data is transmitted to
                  external servers unless you explicitly choose to export or share it.
                </p>
                <p>
                  This page explains what data Moat stores, how it is protected, and how you can
                  control it without leaving the app.
                </p>
              </div>

              <Separator />

              <div className="grid gap-5">
                {sections.map((section, index) => (
                  <div key={section.id} className="grid gap-5">
                    <PrivacySection id={section.id} title={section.title}>
                      {section.content}
                    </PrivacySection>
                    {index < sections.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
