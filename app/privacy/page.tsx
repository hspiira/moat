import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy — Moat",
  description: "How Moat collects, stores, and protects your financial data.",
};

const LAST_UPDATED = "2026-04-06";
const CONTACT_EMAIL = "privacy@moat.local";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/80">
        <Card className="border-border/30 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-muted-foreground">
            Moat is a local-first personal finance application. All data you enter is stored on
            your device only. No data is transmitted to external servers unless you explicitly
            choose to export or share it.
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">1. Who we are</h2>
          <p>
            Moat is a personal finance application designed for individuals and households in
            Uganda. For privacy enquiries, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">2. What data we collect</h2>
          <p>
            Moat collects the financial data you enter directly into the application:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-foreground/70">
            <li>Your display name and profile preferences</li>
            <li>Account names, types, and balances you record</li>
            <li>Transaction records including amounts, dates, categories, and notes</li>
            <li>Savings goals and target amounts</li>
            <li>Budget targets you set</li>
            <li>Any files you import (CSV statements)</li>
          </ul>
          <p>
            We do not collect device identifiers, location data, or any information beyond what
            you explicitly enter. No analytics, tracking pixels, or third-party SDKs are
            included in this application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">3. How we store your data</h2>
          <p>
            All data is stored in your browser&apos;s IndexedDB storage on your device. This data
            does not leave your device unless you use the export or backup features described
            below. Clearing your browser storage or uninstalling the app will permanently delete
            all stored data.
          </p>
          <p>
            We recommend using the encrypted backup feature (Settings → Backup) to protect
            against accidental data loss.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">4. Encryption and security</h2>
          <p>
            Moat offers an optional PIN lock that derives an encryption key from your PIN using
            PBKDF2 (Web Crypto API). When the PIN lock is enabled:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-foreground/70">
            <li>The app requires your PIN to unlock on each session</li>
            <li>Encrypted backup files are protected with AES-GCM encryption using your PIN</li>
            <li>The derived key exists only in memory during your session and is cleared on lock or logout</li>
          </ul>
          <p>
            The PIN lock protects against unauthorized access on shared devices. It does not
            protect data that has already been exported to an unencrypted file.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">5. Your rights under the Uganda Data Protection and Privacy Act 2019</h2>
          <p>
            Under the Uganda Data Protection and Privacy Act 2019 (DPPA), you have the following
            rights regarding your personal data:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-foreground/70">
            <li>
              <strong className="font-medium text-foreground">Right of access</strong>: You can
              export all your data at any time from Settings → Export Data.
            </li>
            <li>
              <strong className="font-medium text-foreground">Right to erasure</strong>: You can
              permanently delete all your data and account from Settings → Delete Account.
            </li>
            <li>
              <strong className="font-medium text-foreground">Right to data portability</strong>:
              The full JSON export contains all records in a structured, machine-readable format.
            </li>
            <li>
              <strong className="font-medium text-foreground">Right to correction</strong>: All
              records can be edited directly within the application.
            </li>
          </ul>
          <p>
            Because all data is stored locally on your device, these rights are exercised
            directly within the application without needing to contact us. If you have questions
            about a specific data concern, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">6. Data retention</h2>
          <p>
            Data is retained on your device until you explicitly delete it. There is no automatic
            deletion or expiry of records. When you delete your account (Settings → Delete
            Account), all stored data is permanently removed from your device&apos;s IndexedDB
            storage. This action cannot be undone.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">7. Third parties</h2>
          <p>
            Moat does not share your data with third parties. The application loads fonts from
            Google Fonts via the Next.js font optimization pipeline. No other external requests
            are made during normal use. Imported CSV files are processed entirely in your browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">8. Changes to this policy</h2>
          <p>
            We will update this policy when the data practices of the application change. The
            &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent
            revision. Continued use of the application after a policy update constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">9. Contact</h2>
          <p>
            For privacy-related questions or data subject requests, contact:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Button asChild variant="outline" size="sm">
          <Link href="/">Return to app</Link>
        </Button>
      </div>
    </div>
  );
}
