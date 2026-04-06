# Uganda Accounting Roadmap: SMS Capture, Accounting Depth, and Growth Opportunities

| Field | Value |
| --- | --- |
| Document Version | 1.2 |
| Status | Research-backed roadmap |
| Owner | Piira |
| Last Updated | 2026-04-06 |
| Product Focus | Uganda-first accounting and ingestion roadmap |

## Executive Summary

The next roadmap should not start with bank APIs. It should start with stronger accounting foundations and then add automatic capture from the channels people in Uganda already use every day.

The strongest near-term path is:

1. Finish the accounting core.
2. Add better imports and reconciliation.
3. Build Android-first message capture around notifications and user-controlled SMS flows.
4. Treat direct inbox SMS access as a separate distribution and policy track, not the default implementation assumption.

This ordering matters because Uganda is not a bank-only market. FinScope Uganda 2023 reports that 66% of adults use mobile money, with send and receive as the dominant use cases. Usage for broader financial services — payments, formal savings, credit — remains much lower. That means money movement is already digital enough to capture, but not through standard consumer finance APIs. A Uganda accounting product should therefore prioritize:

- mobile money alerts
- bank alerts
- CSV and statement imports
- user-reviewed parsing
- explicit reconciliation

instead of waiting for deep institution integrations.

The product should aim to become:

- a personal accounting app for individuals and households
- a light bookkeeping system for salary-plus-side-hustle users
- a Uganda-native transaction inbox for cash, mobile money, bank, SACCO, and long-term savings

## Why SMS and Notifications Matter in Uganda

Two market facts shape the roadmap.

First, the policy direction in Uganda is toward broader formal financial usage. The National Financial Inclusion Strategy 2023-2028 (confirmed by MoFPED) targets at least 85% financial inclusion by 2028, against the FinScope 2023 baseline of 81% — up from 77% in 2018. The same strategy highlights low savings as a continuing challenge. That means an app that improves saving discipline, visibility, and formal product usage fits the direction of the market and policy environment. Sources: [MoFPED NFIS update](https://www.finance.go.ug/media-center/news-and-updates/implementation-national-financial-inclusion-strategy), [FinScope Uganda 2023](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

Second, money movement behavior is mobile-money-heavy. FinScope Uganda 2023 reports that 66% of adults use mobile money, with send and receive being the dominant use cases (58% receive, 26% send). Usage for broader financial services — payments, savings products, credit — remains much lower. This strongly suggests that transaction alerts and movement records are abundant, but value-added financial organization is still weak. Sources: [FSD Uganda: Financial Inclusion Beyond Mobile Money](https://fsduganda.or.ug/financial-inclusion-beyond-mobile-money/), [FinScope Uganda 2023 findings summary](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

That makes SMS and notifications strategically important because:

- they already exist where the transaction happens
- they often arrive faster than statements
- they work across institutions with weak API coverage
- they can cover both mobile money and banks
- they reduce manual entry burden without requiring full bank integrations

## Hard Platform Reality

This part needs precision because it affects architecture and distribution.

### What Android Allows

Android supports `NotificationListenerService`, which receives calls when notifications are posted or removed. The posted notification object includes source package information via `StatusBarNotification`, which means an app can detect and classify transaction alerts from specific apps. Sources: [NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService.html), [StatusBarNotification](https://developer.android.com/reference/android/service/notification/StatusBarNotification.html).

**Android 15 note**: Android 15 introduced OTP content redaction in notifications. The system now automatically redacts OTP-style content from notification text before it reaches third-party listeners. This does not affect standard transaction alerts from banking or wallet apps, which do not use OTP formatting, but it confirms that Google is actively tightening what notification listeners can read. Source: [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all).

This is useful because many banking and wallet apps send notifications even when SMS parsing is restricted or unavailable.

### What Google Play Restricts

Google Play restricts SMS and Call Log permissions as high-risk or sensitive permissions. The policy says apps generally must be the default SMS, Phone, or Assistant handler to use those permissions. However, Google Play also lists `SMS-based money management` as an exception category, with `READ_SMS, RECEIVE_MMS, RECEIVE_SMS, RECEIVE_WAP_PUSH` marked as eligible permissions, subject to review and approval. The same policy also says budgeting apps may not exfiltrate or share non-financial or personal SMS history. Source: [Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en-EN).

The consequence is:

- inbox SMS reading is possible on Android
- but Play approval is not guaranteed
- and even if approved, privacy scope must be extremely tight

This is why SMS should be treated as a deliberate product and policy track, not assumed as a free permission.

### What Google’s SMS APIs Are Actually For

Google’s SMS Retriever and SMS User Consent APIs are for phone number verification and one-time codes. They are not a general-purpose transaction inbox API. The official docs describe them as OTP/verification flows where the app listens for a single verification SMS or receives one-time user consent to read one verification message. Sources: [SMS Retriever overview](https://developers.google.com/identity/sms-retriever/overview), [SMS User Consent overview](https://developers.google.com/identity/sms-retriever/user-consent/overview), [Which API should I use?](https://developers.google.com/identity/sms-retriever/choose-an-api).

So:

- do not build transaction ingestion around SMS Retriever/User Consent
- use them only if the app later adds phone verification flows

### Practical Product Conclusion

For a Play-distributed consumer app, the safest implementation order is:

1. notification capture
2. manual SMS paste/share/import
3. CSV and statement import
4. only then pursue direct SMS inbox reading, with policy review in mind

For a non-Play distribution model, enterprise deployment, or approved SMS exception path, direct SMS reading can be pursued earlier.

## What the Current Product Has Already Solved

The current implementation already covers:

- accounts
- manual transactions
- transfers
- CSV import
- dashboards
- goals
- ledger views
- opening-balance repair
- investment guidance

That means the next roadmap should focus less on broadening surface area and more on:

- correctness
- ingestion
- reconciliation
- automation

## What Previous Versions of This Roadmap Missed

The earlier roadmap covered the SMS and notification capture path well. The sections below document the additional dimensions that were absent and are now incorporated into the phased plan.

### A. Legal Compliance Is a Precondition, Not an Afterthought

The Uganda Data Protection and Privacy Act 2019 (DPPA) came into force on 3 May 2019. It applies to any person or institution collecting and processing personal data. Financial transaction data — account names, amounts, dates, counterparties — clearly qualifies as personal data under the Act.

**What the Act requires:**

- **PDPO registration**: Section 29 of the DPPA and Regulation 15(1) of the Data Protection and Privacy Regulations 2021 require registration with the Personal Data Protection Office (PDPO) under NITA-U before collecting or processing personal data. Operating without this registration is a criminal offence under the Act.
- **Explicit consent before collection**: The app must present a privacy notice before any data is collected. The notice must state what is collected, why, how long it is retained, and with whom (if anyone) it is shared. The current onboarding flow does none of this.
- **Data subject rights**: Users must be able to access, correct, and delete their data on request. The app currently has no export-my-data or delete-account flow.
- **Retention limits**: Data must not be kept beyond the stated purpose. A retention policy must be documented and enforced.

**Why this is urgent**: Any SMS or notification capture feature that touches message content without a privacy framework and PDPO registration exposes the product and its owner to criminal liability under Sections 28 and 29 of the Act. Compliance must precede any data collection expansion.

The Uganda Communications Act 2023 and Uganda Communications (Content) Regulations 2019 add a second layer: any feature that reads, routes, or processes data communications (including SMS content) must align with UCC standards for data communications and user disclosure.

Sources: [Data Protection and Privacy Act 2019 - ULII](https://ulii.org/en/akn/ug/act/2019/9/eng@2019-05-03), [DPPA Guide - Securiti](https://securiti.ai/uganda-data-protection-and-privacy-act/), [UCC Regulations - UCC](https://www.ucc.co.ug/standards-regulations-guidelines-and-frameworks/), [SMS compliance guidance - Sent.dm](https://www.sent.dm/resources/ug-sms-guidance).

---

### B. IndexedDB Is Unencrypted — Data Security Is a Gap

The current data model stores everything in browser IndexedDB with no encryption at rest. On a rooted Android device, all records are accessible. On a shared device — which is common in Uganda, where family members routinely share smartphones — any browser session or installed PWA can access another user's financial data without any barrier.

This is a material security gap for a financial application.

**What must be added:**

- **App-level PIN or biometric lock** before the workspace loads. On web, the Web Authentication API (WebAuthn) supports biometric prompt. On Android native or a Capacitor wrapper, `BiometricPrompt` is the standard. A PIN that gates a derived encryption key is the minimum viable approach.
- **Client-side encryption of stored records** using the Web Crypto API (`crypto.subtle`). Records are encrypted with a key derived from the user's PIN via PBKDF2. This is the standard approach for local-first PWAs handling sensitive data.
- **Session timeout**: Auto-lock after a configurable period of inactivity.
- **Clear on explicit logout**: Wipe derived keys from memory; require PIN re-entry on next session.

Sources: [Web Authentication API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API), [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), [PBKDF2 key derivation - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey).

---

### C. There Is No Data Backup or Recovery Path

IndexedDB data is permanently lost if browser storage is cleared, the device is reset, or the user switches phones. There is no backup, no export, no restore. For a financial tracking app, this is the single biggest practical trust risk — a user who loses six months of transaction history will not return.

**What must be added:**

- **Full JSON export**: A complete, human-readable dump of all accounts, transactions, goals, and categories. This also satisfies DPPA data portability rights.
- **Encrypted backup file**: The JSON export is encrypted with the user's PIN before download. The user stores the file wherever they choose — Google Drive, WhatsApp to self, USB. On a new device, they import the file and enter their PIN to restore.
- **Optional cloud sync (later stage)**: An encrypted blob pushed to user-controlled storage (Google Drive API, or a minimal backend) without requiring a server-side plaintext copy.

DPPA Article on data portability reinforces this as a user right, not just a feature. Sources: [DPPA 2019 - ULII](https://ulii.org/en/akn/ug/act/2019/9/eng@2019-05-03).

---

### D. The App Is Not Actually Installable as a PWA

Uganda's internet penetration is 28% (14.2 million users, Jan 2025, DataReportal). Android has 82% OS market share. Typical consumer devices run 2–4 GB RAM. Network quality outside Kampala is variable. In this context, a web app that requires a live connection and a browser URL every session is significantly weaker than an installable PWA.

The current app does not have a web app manifest, a service worker, or an install prompt. Without these, users cannot add it to their Android home screen, the app shell is not cached for offline use, and there is no background sync when connectivity returns.

**What must be added:**

- **`manifest.json`** with `name`, `short_name`, icons at 192px and 512px, `display: standalone`, `theme_color`, `background_color`.
- **Service worker** with offline-first caching strategy for the app shell and static assets (Workbox is the standard library for Next.js PWA builds).
- **Install prompt UI** via the `beforeinstallprompt` browser event — surface this as a non-intrusive banner after the first meaningful session.
- **Web Background Sync API** to queue transactions entered offline and sync when connectivity returns.
- **Web Push API** for goal reminders and savings alerts (requires user permission; off by default).

Sources: [DataReportal Digital 2025 Uganda](https://datareportal.com/reports/digital-2025-uganda), [Workbox PWA toolkit - Google](https://developer.chrome.com/docs/workbox/), [Web App Manifest - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest), [Background Sync - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

---

### E. No Budget System — Goals and Budgets Are Different Things

The app has goals (save UGX X by date Y) but no monthly budget (spend at most UGX X in category Z this month). These solve different problems. Goals answer "where am I going?" Budgets answer "where is the money going right now?" Both are needed for practical personal finance.

Uganda users dealing with variable income — salary plus side hustle, seasonal cash flows, irregular vendor payments — need real-time visibility into whether they are on track within the current period, not just a long-term savings target.

**What a Uganda-relevant budget system looks like:**

- Monthly envelope allocation per category (rent, food, airtime, school fees, transport)
- Remaining envelope balance updates in real time as transactions are posted
- Overspend alerts when a category goes negative
- Rollover option for underspent envelopes (common in savings-oriented households)
- Irregular income support: allocate against an income event rather than a calendar month (e.g., "this paycheque: allocate UGX X to school fees buffer")
- Category budget summary visible from the transactions view

The envelope method is well-established in personal finance literature and is the basis of zero-based budgeting tools. It maps naturally onto the category system already in the data model. Sources: [FinScope Uganda 2023 savings challenge findings](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

---

### F. Debt Tracking Is Incomplete

The app has a `debt` account type but no debt management features. This matters for the Uganda context. FinScope 2023 reports that 16% of adults access credit through mobile money. SACCOs and microfinance institutions are common formal lenders. Informal lending — between friends and family — is widespread and almost never tracked.

A debt account in the current model is just a number. It does not tell the user:

- What the interest rate is and the total cost of the obligation
- The repayment schedule and next payment due date
- The payoff timeline at the current contribution rate
- Whether it is better to pay off debt before contributing to savings goals (this depends on the interest rate vs. expected savings return)

**What to add:**

- Debt record fields: principal, interest rate (flat or reducing balance), lender type (formal bank / SACCO / microfinance / informal), start date, term, repayment frequency
- Automatic outstanding balance calculation from payment history
- Monthly interest projection and total cost display
- Payoff date calculator given current payment level
- Priority guidance: if debt interest rate exceeds savings product return, flag this to the user

Sources: [FinScope Uganda 2023 credit findings](https://fsduganda.or.ug/finscope-uganda-2023-survey/), [UMRA licensed microfinance list](https://umra.go.ug/).

---

### G. WhatsApp Share-to-App Should Be Phase 1, Not Phase 2

The previous roadmap placed share-to-app intake in Phase 2. This is too late. "Nearly all internet users in Uganda rely on WhatsApp for communication" (DataReportal 2025). Financial information in Uganda is routinely shared via WhatsApp — mobile money confirmations forwarded between spouses, bank alert screenshots sent in family groups, receipts photographed and shared.

An Android share intent receiver that accepts `text/plain` from WhatsApp (or any app) has near-zero policy risk, requires no permissions, and can be shipped before any parser exists. It should be the earliest data ingestion path because:

- It trains the parser on real Ugandan message formats from day one
- It is available on Android and iOS
- It gives users immediate value without requiring notification access
- It produces the dataset needed to calibrate parser templates for Phase 3

**The flow:**

1. User receives a mobile money confirmation in WhatsApp
2. Long-press → Share → Moat
3. Moat receives via Android intent filter for `text/plain`
4. Text is passed to the parser, which produces a pre-filled transaction form
5. User reviews and posts

**Implementation requirements**: Android intent filter declaration in `AndroidManifest.xml` (or Capacitor plugin equivalent), a web-based paste input as fallback, and the basic parser pipeline. The parser pipeline is already in the Phase 3 plan — moving share intake earlier means it can start producing value and training data immediately.

Sources: [DataReportal Digital 2025 Uganda](https://datareportal.com/reports/digital-2025-uganda), [Android share intents - Android Developers](https://developer.android.com/training/sharing/receive).

---

### H. URA Tax Alignment for Self-Employed and Mixed-Income Users

The roadmap does not mention tax at all. This is a gap for the product's core audience: salary-plus-side-hustle users.

Uganda Revenue Authority's EFRIS (Electronic Fiscal Receipting and Invoicing System) became mandatory for all VAT-registered businesses as of April 2025. E-invoices must be issued in JSON format and transmitted to URA in real time for validation. Online filing via URA's e-Returns system is now the standard path for annual income tax and monthly VAT returns.

The VAT registration threshold is UGX 150 million in annual taxable turnover. A self-employed user approaching this through a combination of employment income, side-hustle income, and freelance work may not realise they are approaching a compliance obligation.

**This does not mean building a tax product. It means:**

- Category tagging that aligns with URA income and expense classifications: employment income, business income, rental income, capital gains; business expenses vs. personal expenses
- Income stream separation (salary vs. side hustle) with a clear split in reports
- An annual "tax preparation export" — structured CSV or PDF of all income and business expenses for the year, formatted to hand to an accountant or enter into URA's system
- A soft threshold alert: "Your recorded business income this year has reached UGX X — consider consulting a tax professional about VAT registration obligations"
- EFRIS QR code field on transaction records (for users who are already VAT-registered and need to log received fiscal receipts)

Sources: [URA EFRIS overview - ClearTax](https://www.cleartax.in/ug/e-invoicing-uganda), [URA e-Returns](https://ura.go.ug/en/), [VAT registration threshold - URA](https://ura.go.ug/en/).

---

### I. No Testing Infrastructure — A Growing Codebase with No Safety Net

The codebase recently added Vitest but there are no test files. The roadmap has no testing phase. As the product grows in complexity — adding parsing, reconciliation, debt calculations, and budget logic — the absence of tests makes every change risky and slows down confident refactoring.

The highest-risk files from a correctness standpoint:

- `lib/domain/accounts.ts` — wrong reconciliation directly corrupts balances
- `lib/domain/goals.ts` — incorrect contribution math misleads financial planning
- `lib/domain/summaries.ts` — wrong period aggregation gives users false financial picture
- `lib/import/csv.ts` — silent parse errors corrupt transaction history
- The SMS/notification parser once built — a parsing mistake creates a wrong transaction the user may never notice

**Minimum testing strategy:**

- Unit tests for all `lib/domain/` functions with known inputs and expected outputs
- Unit tests for the CSV parser covering malformed input, encoding issues, and empty columns
- Property-based tests using `fast-check` for reconciliation logic — these discover edge cases that hand-written unit tests miss (e.g., floating point rounding, zero amounts, future-dated transactions)
- Snapshot or regression tests for the SMS parser once templates are established
- No E2E UI tests needed until the product stabilises further

Testing should begin in parallel with Phase 1, not deferred to a later phase. Sources: [Vitest documentation](https://vitest.dev/), [fast-check property testing](https://fast-check.io/).

---

### J. Multi-Currency Is a Data Model Decision That Must Be Made Now

Uganda's UGX is the domestic currency, but the user base will regularly encounter USD and KES:

- Diaspora remittances arrive in USD and are converted to UGX on receipt via mobile money
- Cross-border trade with Kenya is settled in KES or USD
- A common savings strategy among salaried Ugandans is holding some savings in USD to hedge UGX depreciation
- Some investment returns (T-bills, CIS) are quoted or benchmarked in USD

The current data model uses `amount` as a raw number with an implicit UGX assumption. Adding multi-currency later requires a data migration. Adding the fields now — even with deferred conversion rate logic — costs almost nothing and prevents a painful schema change.

**Minimum change:**

Add `currency: string` (defaulting to `"UGX"`) and `originalAmount: number` (defaulting to `amount`) to the `Transaction` type. Store the conversion rate at time of entry as `fxRateToUgx: number | undefined`. The conversion display logic and historical rate lookup can come later.

Sources: [Bank of Uganda exchange rate data](https://www.bou.or.ug/bou/rates_statistics/Rates/exchange_rates.html), [FinScope Uganda 2023 on remittances](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

---

### K. Financial Education Content Needs a Strategy, Not Just a Workspace

The "Learn" workspace exists but the roadmap says nothing about what it contains, how content is maintained, or what makes it Uganda-relevant. Generic personal finance content (emergency fund = 3 months expenses, invest early) is available everywhere. This product's advantage is local specificity.

**Uganda-specific content that is genuinely useful and not available in generic apps:**

- How SACCOs work, what a legitimate SACCO looks like, and how to use the UMRA licensed SACCO register to check before joining
- How Treasury bills and bonds work via the Uganda Securities Exchange, what the realistic minimum investment is, and how the primary auction process works
- The difference between CIS options currently licensed by CMA Uganda, with the asset classes each fund type covers
- How to read a mobile money statement and identify agent fees, float charges, and withdrawal costs
- The mathematics of informal savings groups (chamas / ROSCAs) compared to a formal savings account — when informal is better and when it is worse
- How to approach the salary-plus-side-hustle tax question without triggering unnecessary anxiety
- What URBRA pension membership means for employed workers and what happens to contributions when someone changes employer

**Content governance requirements:**

- Each article should cite its source (URA, BoU, UMRA, CMA, USE)
- Articles should be dated and reviewed at least annually — regulatory details change
- Content should be stored as structured data (MDX or JSON), not hardcoded in components, so it can be updated without a code deployment

Sources: [UMRA licensed SACCOs](https://umra.go.ug/), [CMA licensed funds](https://cmauganda.co.ug/), [USE T-bills and bonds](https://use.or.ug/securities/bonds), [URBRA member guidance](https://urbra.go.ug/).

---

### L. Bank of Uganda Regulatory Sandbox Is an Ignored Strategic Path

Bank of Uganda launched its regulatory sandbox in 2021 to allow fintech firms to test technologies in a controlled environment. Approved participants gain direct engagement with BoU during testing, and data from sandbox trials is used to draft guidelines and improve existing laws. At least one firm has been approved to test QR-based payment technology within the sandbox.

This is relevant for Moat because:

- It is the formal path to BoU recognition for a fintech product
- Sandbox participation provides regulatory clarity on novel features — specifically relevant for notification-based transaction capture, which sits in a policy grey area without explicit BoU guidance
- It positions the product for future relationships with banks and MNOs, which are necessary for any notification partnership, statement import agreement, or USSD feature
- BoU sandbox graduates have an easier path to licensing and formal product launch

The sandbox should be listed as a strategic track alongside the SMS policy track. The right time to apply is after Phase 1 (accounting core) is complete and before Phase 3 (parser and automated capture) begins — when the product is solid enough to demonstrate but before it operates at scale.

Sources: [BoU Regulatory Sandbox announcement - Bitcoin.com](https://news.bitcoin.com/bank-of-uganda-launches-regulatory-sandbox-framework-one-fintech-firm-already-approved/), [Bank of Uganda fintech commitments](https://www.bou.or.ug/), [Open Banking in Africa - Open Bank Project](https://www.openbankproject.com/blog/regulatory-sandboxes-in-africa/).

---

### M. USSD as a Reach Layer for Users Without Smartphones

Uganda has 88% mobile penetration but only 59% internet penetration (UCC Q1 2025 data). USSD continues to hold majority market share in Uganda's mobile money market and is the primary access layer for an estimated 70% of the population without smartphones.

USSD is not a core feature for a PWA, but it matters as a reach strategy:

- A USSD shortcode can allow feature-phone users to log a simple transaction (cash in, cash out, amount) that syncs to their Moat account when they next open the app on a smartphone
- Balance enquiries and goal progress could be surfaced via USSD for users who have low smartphone time
- Reminder messages for savings goals can be sent as USSD push notifications

**Realistic implementation path**: USSD access requires a partnership with a licensed payment service provider or directly with MTN or Airtel Uganda under an agreement. It cannot be built independently. This is a later-stage feature that depends on traction and commercial relationships.

The Uganda Communications Commission inquiry found that MTN and Airtel's USSD pricing is "set at excessive rather than competitive levels," which creates real cost friction. This should be factored into any USSD business model analysis.

Sources: [FSD Uganda USSD analysis](https://fsduganda.or.ug/unpacking-the-world-of-ussd-technology/), [FSD Uganda alternatives to USSD](https://fsduganda.or.ug/what-will-it-take-to-adopt-alternative-technologies-to-ussd-in-ugandas-financial-sector/), [Uganda Mobile Money Market - IMARC](https://www.imarcgroup.com/uganda-mobile-money-market), [USSD fintech relevance 2025 - MBU](https://mbu.ug/2025/06/12/ussd-relevance-fintech-africa-2025/).

---

### N. BoU Consumer Protection Guidelines Apply to Any Financial Feature

Bank of Uganda issued Financial Consumer Protection Guidelines in June 2011. While they formally apply to supervised financial institutions (banks, MDIs, credit institutions), they represent the disclosure and fairness standard that BoU expects of any product in the financial services space. UMRA issues parallel guidelines for microfinance and SACCO-adjacent products.

**Principles relevant to this product:**

- **Fee transparency**: Any feature that involves a cost to the user must disclose it clearly before the user commits
- **Key Facts Document standard**: If any credit or savings product is ever surfaced in the app (e.g., linking to a formal savings product), it must be preceded by a plain-language fact sheet
- **Complaint mechanism**: Users must have a clear, accessible way to raise concerns or report errors
- **No misleading projections**: Goal contribution calculations and investment return estimates must be clearly labelled as projections, not guarantees

These principles should inform UI copy across the app — particularly in the goals workspace, investment compass, and any future debt or credit features.

Sources: [BoU Financial Consumer Protection Guidelines 2011](https://www.dfcugroup.com/wp-content/uploads/2021/11/Bank-of-Uganda-Financial-Consumer-Protection-Guidelines-2011.pdf), [UMRA Consumer Protection Guidelines](https://umra.go.ug/financial-consumer-protection-guidelines/), [UNCDF Uganda consumer protection landscape](https://policyaccelerator.uncdf.org/whats-new/navigating-ugandas-regulatory-landscape-consumer-protection-through-robust-legal-regulatory-frameworks).

---

## Recommended Roadmap Order

## Phase 0: Compliance and Security Baseline (Before Any Public Launch)

This phase has no optional items. Until it is complete, the product should not be distributed beyond private pilot.

### 0.1 Legal Compliance

- ✅ Draft and publish a privacy policy written to DPPA 2019 standards — `app/privacy/page.tsx` covers data collected, retention, user rights, and contact
- ✅ Add a consent notice to the onboarding flow that requires explicit acceptance before any data is stored — checkbox with privacy policy link added to `components/onboarding-workspace.tsx`; submit button disabled until checked
- ⏳ Register with the Personal Data Protection Office (PDPO) under NITA-U — administrative step, not a code task
- ✅ Add a data subject rights flow: export all my data, delete my account and all records — `app/settings/page.tsx` with Data Export panel (JSON download) and Delete Account panel (requires typing "delete everything" to confirm)
- ✅ Document a data retention policy (how long transaction records are kept, what is deleted on account closure) — covered in privacy policy Section 6

**Why**: Operating without PDPO registration while collecting personal financial data is a criminal offence under DPPA Section 29. This is not a best-practice item — it is a legal requirement.

### 0.2 Data Security

- ✅ Implement an app-level PIN lock using a key derived via PBKDF2 from the Web Crypto API — `lib/security/pin-crypto.ts` (PBKDF2 310k iterations / SHA-256 / AES-GCM 256-bit), `lib/security/pin-lock-context.tsx` (PinLockProvider), `components/pin-lock-screen.tsx` (full-screen lock overlay); wired into `app/layout.tsx`
- ✅ Session timeout with auto-lock after 5 minutes of inactivity — implemented in PinLockProvider with activity listener reset
- ✅ Derived key cleared from memory on explicit logout — key never persisted; only the PBKDF2-encrypted sentinel lives in localStorage to verify the PIN
- ⏳ Encrypt individual IndexedDB records at rest using the derived key — not yet done; requires wrapping repository writes with AES-GCM encryption per record. Deferred to a future security hardening pass.

**Why**: IndexedDB is unencrypted. On shared devices — common in Uganda — any browser session can read another user's financial data without any barrier.

### 0.3 Backup and Data Portability

- ✅ Full JSON export of all user data (satisfies DPPA portability right) — `lib/security/data-export.ts` `collectFullExport()` + `downloadJson()`, surfaced in Settings → Export your data
- ✅ Encrypted backup file download — JSON export encrypted with AES-GCM using user-chosen PIN (separate from app PIN), downloadable as `.enc` file; `components/settings/backup-panel.tsx`
- ✅ Encrypted backup restore flow — user uploads `.enc` file, enters backup PIN, data is decrypted and written back to all IndexedDB stores; same panel

**Why**: Local-only storage with no backup means a device reset or storage clear destroys all financial history. No user will trust a financial app that can silently lose their data.

### 0.4 PWA Baseline

- ✅ Add `manifest.json` with name, short name, icons, `display: standalone`, `theme_color` — `app/manifest.ts` complete
- ✅ Add service worker with offline-first caching of the app shell and static assets — `public/sw.js` complete; cache-first for static assets, network-first with offline fallback for navigation
- ✅ Surface install prompt via `beforeinstallprompt` event after first meaningful session — `components/pwa-status.tsx` handles `beforeinstallprompt`, shows Install app button, tracks installed state
- ✅ Offline fallback page — `app/offline/page.tsx` exists and is pre-cached by the service worker
- ⏳ Web Background Sync for transactions entered offline — deferred; requires background sync API (Android only) and a sync queue in the repository layer

**Why**: Without these, the app cannot be added to the Android home screen and requires a live network connection on every launch. Uganda's internet penetration is 28% and network quality outside Kampala is variable. A PWA that works offline is a materially better product for the target market.

## Phase 1: Strengthen the Accounting Core

This should happen before aggressive automation.

### Why

Automatic capture is dangerous if the accounting model is still too loose. Imported errors scale faster than manual errors.

### What to Build

- Running balance column in ledgers.
- Explicit period opening balance, movement, and closing balance in dashboards.
- Reconciliation state per transaction:
  - `draft`
  - `parsed`
  - `reviewed`
  - `posted`
  - `matched`
- Payee / counterparty normalization.
- Transaction rules:
  - sender-based
  - keyword-based
  - amount-pattern-based
- Recurring obligations:
  - rent
  - school fees
  - data / airtime
  - SACCO contribution
  - salary
- Month close workflow:
  - unresolved transactions
  - duplicate alerts
  - category review
  - export

### Why It Is Needed

Without this, automatic ingestion will only produce a larger pile of untrusted records. The product must first become a reliable accounting destination.

### Phase 1 Parallel: Testing Infrastructure

Begin building tests alongside Phase 1 accounting work. Do not defer.

**Unit tests for all `lib/domain/` functions:**

- `reconcileAccountBalances` — wrong reconciliation directly corrupts user balances; test with opening balance variations, multiple transaction types, and zero-amount edge cases
- `getGoalContributionPlan` — incorrect math on monthly targets misleads financial planning; test deadline boundary conditions and overfunded goals
- `getMonthSummary` — wrong period aggregation gives users a false financial picture; test month boundary, empty period, and future transaction cases
- `parseCsvText` — import errors silently corrupt history; test malformed input, mixed encoding, empty columns, and header-only files

**Property-based tests using `fast-check`:**

- Reconciliation logic: verify that `openingBalance + sum(transactions) === currentBalance` holds for any valid transaction set, including arbitrary orderings and floating-point edge cases
- CSV parser: verify that parsing a re-serialised output produces the same result (round-trip stability)

**Why**: A financial product with no tests cannot be refactored with confidence. As the parser, budget system, and debt calculator are added, each new feature depends on the correctness of the domain layer. Unit and property-based tests are the only reliable way to catch regressions before they reach users.

Sources: [Vitest documentation](https://vitest.dev/), [fast-check property-based testing](https://fast-check.io/).

## Phase 1.5: Budget System and Debt Management

These features belong between Phase 1 (accounting core) and Phase 2 (capture), because they depend on a reliable transaction model but do not require automated ingestion.

### 1.5.1 Monthly Budget and Envelope System

**What to build:**

- Monthly budget record per category: allocated amount, spent to date, remaining
- Envelope balance updates in real time as transactions are posted against a category
- Overspend indicator when a category goes negative
- Rollover option for underspent envelopes at month end
- Irregular income support: allocate a paycheque or income event to envelopes rather than relying on calendar month reset
- Budget summary view: one screen showing all envelopes for the current period with progress bars

**Why**: Goals tell users where they are going. Budgets tell users whether the current month's spending will allow them to get there. Without a budget system, users record transactions but have no real-time feedback on whether they are on track. This is the most commonly cited reason manual tracking fails — the feedback comes too late.

The envelope method maps directly onto the category system already in the data model. No schema migration is required, only a new `Budget` record type with `userId`, `month`, `categoryId`, and `allocatedAmount`.

Sources: [FinScope Uganda 2023 savings challenge findings](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

### 1.5.2 Debt Tracker

**What to build:**

- Debt record fields: principal, interest rate, interest type (flat rate or reducing balance), lender type (bank / SACCO / microfinance / informal), start date, term, repayment frequency
- Outstanding balance calculated from the payment history against the debt account
- Monthly interest projection: how much of the next payment is principal vs. interest
- Total cost of debt display: sum of all payments at current rate vs. original principal
- Payoff date calculator: given current payment level, when does the debt clear?
- Priority guidance: if the debt interest rate is materially higher than the expected return on a savings goal, flag this to the user with a plain-language explanation

**Why**: FinScope 2023 reports 16% of adults access credit through mobile money. SACCO and microfinance lending is common. Informal lending between family and friends is widespread and almost never tracked. A debt account in the current model is just a balance — it provides no actionable information. Full debt visibility is a prerequisite for honest financial planning.

Sources: [FinScope Uganda 2023 credit access findings](https://fsduganda.or.ug/finscope-uganda-2023-survey/), [UMRA microfinance registry](https://umra.go.ug/).

### 1.5.3 Multi-Currency Fields

**What to add:**

- `currency: string` field on `Transaction`, defaulting to `"UGX"`
- `originalAmount: number` field, defaulting to `amount`
- `fxRateToUgx: number | undefined` field, storing the conversion rate at time of entry

The conversion display logic, historical rate lookup, and currency selector UI can all be deferred. Adding the fields now costs almost nothing. Adding them later requires a data migration.

**Why**: Uganda users regularly encounter USD and KES. Diaspora remittances arrive in USD and convert on mobile money receipt. Cross-border trade with Kenya is settled in KES or USD. Savings in USD as a UGX depreciation hedge is common among salaried workers. Some investment products are benchmarked in USD. The current implicit UGX-only assumption will break for these users.

Sources: [BoU exchange rate data](https://www.bou.or.ug/bou/rates_statistics/Rates/exchange_rates.html), [FinScope Uganda 2023 on remittances](https://fsduganda.or.ug/finscope-uganda-2023-survey/).

## Phase 2: Add Simple Capture Before Restricted Capture

This is the right place to start automation.

### 2.1 Share-to-App and Paste-to-App Intake (Ship First)

Build this before notification capture. It has zero policy risk, requires no Android permissions, works on Android and iOS, and starts producing parser training data from day one.

**What to build:**

- Android intent filter for `text/plain` in `AndroidManifest.xml` (or Capacitor plugin equivalent): when the user shares text from WhatsApp, SMS app, or any other app, Moat receives it
- Web-based paste input as fallback for users on desktop or browser-only: a text area where the user pastes a transaction confirmation message
- On receipt, pass the text through the parser pipeline (Phase 3) to produce a pre-filled transaction form
- User reviews the pre-filled form and posts with one tap

**The WhatsApp flow:**

1. User receives a mobile money confirmation in WhatsApp
2. Long-press → Share → Moat
3. Moat receives via Android intent, passes text to parser
4. Parser produces pre-filled form (amount, date, type, counterparty)
5. User confirms and posts

**Why this is Phase 2.1 and not Phase 2.2**: "Nearly all internet users in Uganda rely on WhatsApp" (DataReportal 2025). Financial information in Uganda is routinely shared via WhatsApp — mobile money confirmations forwarded between spouses, bank alert screenshots, receipts photographed and sent. The share intent is the lowest-friction data capture path available. It should be the first path built, because it also generates the real-format message dataset needed to build accurate parser templates in Phase 3.

Sources: [DataReportal Digital 2025 Uganda](https://datareportal.com/reports/digital-2025-uganda), [Android receive intents - Android Developers](https://developer.android.com/training/sharing/receive).

### 2.2 Notification Capture

Build an Android-native notification listener companion.

#### What it does

- captures transaction notifications from supported apps
- extracts:
  - source app package
  - posted time
  - title/body text
  - optional sender signature
- sends the raw notification into an on-device parsing pipeline

#### Why it matters

- no reliance on direct bank APIs
- works for many banking and wallet apps
- lower friction than manual entry
- avoids immediate dependence on restricted SMS inbox permissions

#### Key Requirements

- Android native module or React Native / Capacitor bridge
- allowlist of watched packages
- local parser templates
- review queue before posting into the ledger

### 2.3 Statement Import Expansion

Current CSV import should grow into:

- import templates per bank or wallet
- PDF statement parsing where possible
- saved column mappings
- import reconciliation against existing transactions

#### Why it matters

- reliable backfill
- good for month-end accounting
- good for users who want to start with history

## Phase 3: Build the Parsing Engine

This is the core of SMS- or notification-driven accounting.

### Canonical Parse Pipeline

1. Capture raw message.
2. Detect source:
   - MTN MoMo
   - Airtel Money
   - bank sender / package
   - generic unknown source
3. Parse fields:
   - amount
   - currency
   - debit / credit direction
   - reference id
   - balance if present
   - date / time
   - counterparty
   - fee
4. Normalize into canonical transaction candidates.
5. Deduplicate against existing records.
6. Send to review queue.
7. Post to ledger after user confirmation or trusted rule.

### Parser Design

Start with deterministic templates, not AI-only extraction.

Use:

- regex patterns
- sender signature matching
- app package matching
- field confidence scoring

Add LLM-assisted extraction only as a fallback for unknown formats.

### Why

Uganda transaction alerts are structured enough that deterministic parsing should cover a large share of cases. That is cheaper, more debuggable, and more compliant with privacy-first on-device processing.

## Phase 4: SMS Inbox Reading Track

This should be a separate workstream, not mixed into the base roadmap assumptions.

### Option A: Play-Distributed SMS Exception Track

Pursue this only if:

- the product makes SMS-based money management a core feature
- parsing is on-device
- only financial senders are ingested
- raw message retention is minimized
- the app provides clear disclosure and consent

This is technically viable but policy-sensitive.

### Option B: Non-Play / Enterprise / Pilot Distribution

For private pilots, institutional deployments, or direct APK distribution, direct SMS reading can be used earlier.

This path is higher capability but weaker on mainstream distribution.

### Minimum Safe Controls for Direct SMS Reading

- explicit sender allowlist
- financial-message-only filtering
- user review queue by default
- no cloud sync of raw SMS unless separately consented
- local encryption for stored raw text
- store parsed fields and message hash; optionally discard full body after parse

## Phase 5: Become a Real Personal Accounting System

This is where the product becomes more than a tracker.

### What to Add

- chart of accounts for personal finance
- account purpose flags:
  - spending
  - savings
  - debt
  - investment
  - business
- journal-based posting model under the hood
- transfer matching and clearance
- attachment support:
  - receipt
  - statement
  - screenshot
- audit trail:
  - created from manual entry
  - created from import
  - created from notification
  - created from SMS
- split transactions
- household support transfers
- accrual-like reminders:
  - school fees due
  - rent due
  - loan installment due

### Why

Ugandan users often need practical accounting, not just budgeting. The app should evolve toward:

- personal accounting
- micro-household planning
- side-hustle cash separation

without forcing full SME accounting from day one.

## Uganda-First Opportunities the Product Should Target

These are the most defensible opportunities based on local behavior and regulatory direction.

### 1. Mobile Money Accounting

This is the biggest immediate opportunity.

Reason:

- mobile money is already the dominant movement channel for many users
- alerts and messages are abundant
- the user pain is not “can I send money?” but “what actually happened to my money?”

Product moves:

- MTN / Airtel parser packs
- agent cash-in / cash-out handling
- fee extraction
- family support transfer tagging

### 2. Savings Allocation Discipline

The policy environment still identifies low savings as a major challenge.

Product moves:

- split `saved` versus `allocated to savings`
- sinking funds for rent, fees, travel, school
- emergency reserve ladder
- savings leakage alerts

### 3. SACCO and Regulated Product Tracking

Uganda users often move between informal and formal systems. The app should help formalize decision quality.

Product moves:

- SACCO account tracking
- license verification workflow using UMRA references
- treasury bill / bond maturity tracker
- CIS / unit trust tracker
- retirement contribution tracker

Reasons:

- CMA reported licensed CIS assets at UGX 5.66 trillion and 206,405 funded accounts as of Q4 2025, up from the 1.15 trillion milestone first crossed in early 2025. Growth is accelerating.
- URBRA reported retirement assets at UGX 30.7 trillion and 4,062,144 savers as of the 2024/25 financial year.
- USE continues to provide direct access to Treasury bills and bonds.

Sources:

- [CMA Capital Markets Quarterly Bulletin Q1 2025](https://cmauganda.co.ug/wp-content/uploads/2022/05/Capital-Markets-Quarterly-Bulletin-1Q-2025.pdf)
- [CMA CIS milestone announcement](https://cmauganda.co.ug/2024/11/26/ugandas-collective-investment-scheme-assets-cross-ugx-1-trillion/)
- [URBRA sector growth](https://urbra.go.ug/2026/03/10/record-growth-sustainability-challenge-ugandas-retirement-savings-hit-ugx30-trillion/)
- [USE debt instruments](https://use.or.ug/securities/bonds)
- [UMRA SACCO guidelines](https://umra.go.ug/wp-content/uploads/2021/09/SACCO-GUIDELINES.pdf)

### 4. Salary Plus Side-Hustle Accounting

This is likely the strongest consumer segment.

Reason:

- FinScope shows mixed income structures remain common
- many users need household accounting plus small-business visibility

Product moves:

- income stream tagging
- side-hustle separation
- envelope-style goals by source
- tax/export support later

### 5. Financial Opportunity Discovery

This should be educational and rules-based, not speculative.

What the app can surface:

- when the user has stable surplus and can consider T-bills
- when a user should first repair emergency savings
- when a user may be ready for CIS or retirement top-ups
- whether a SACCO is licensed and appropriate to consider

This fits the policy environment, which is pushing usage of quality formal products rather than pure access.

## Phase 5.5: Tax, USSD, Regulatory Positioning, and Education

### 5.5.1 URA Tax Alignment

This does not mean building a tax product. It means ensuring that the data already in the app is structured for tax-aware export.

**What to build:**

- Category taxonomy aligned with URA income and expense classifications: employment income, business income, rental income, capital gains; business expenses vs. personal expenses
- Income stream separation report: salary vs. side hustle vs. other, per period
- Annual tax preparation export: structured CSV of all income and business-tagged expenses for the year, formatted for an accountant or URA e-Returns entry
- VAT threshold soft alert: "Your recorded business income this year has reached UGX X — consider consulting a tax professional about VAT registration obligations" (threshold: UGX 150 million)
- EFRIS QR code field on transactions for VAT-registered users who need to log received fiscal receipts

**Why**: EFRIS became mandatory for all VAT-registered businesses in April 2025. URA's e-Returns system is the standard path for online filing. Salary-plus-side-hustle users approaching the VAT threshold may not realise they are approaching a compliance obligation. The app is already capturing the data needed to help them — it just needs the right categorisation and export format.

Sources: [URA EFRIS - ClearTax Uganda](https://www.cleartax.in/ug/e-invoicing-uganda), [URA e-Returns system](https://ura.go.ug/en/), [Uganda VAT Act - ULII](https://ulii.org/en/legislation/act/2019/ug-act-2019-8).

### 5.5.2 USSD as a Reach Layer

USSD remains the primary access layer for the estimated 70% of the Ugandan population without smartphones. Uganda has 88% mobile penetration but only 59% internet penetration (UCC Q1 2025). A USSD shortcode would extend Moat's reach to users who cannot run the PWA.

**What a USSD layer would allow:**

- Simple transaction logging from a feature phone: cash in / cash out, amount, account
- Balance enquiry: current account balance returned as USSD text
- Goal progress: percentage complete for a named goal
- Savings reminders: USSD push message for scheduled savings contributions

**Implementation reality**: USSD requires a partnership with a licensed payment service provider, or a direct commercial agreement with MTN Uganda or Airtel Uganda under Uganda's National Payment Systems Act 2020. It cannot be built independently. UCC has also found that MTN and Airtel's USSD pricing is set at excessive levels, which creates cost friction that must be factored into any business model analysis.

This is a late-stage feature contingent on commercial traction and regulatory positioning. List it as a strategic option, not a near-term build item.

Sources: [FSD Uganda USSD analysis](https://fsduganda.or.ug/unpacking-the-world-of-ussd-technology/), [FSD Uganda alternatives to USSD](https://fsduganda.or.ug/what-will-it-take-to-adopt-alternative-technologies-to-ussd-in-ugandas-financial-sector/), [Uganda National Payment Systems Act 2020](https://www.bou.or.ug/bou/bou-downloads/financial-stability/legal-framework/2021/National-Payment-Systems-Act-2020.pdf), [USSD fintech relevance 2025 - MBU](https://mbu.ug/2025/06/12/ussd-relevance-fintech-africa-2025/).

### 5.5.3 Bank of Uganda Regulatory Sandbox

BoU launched its regulatory sandbox in 2021. Sandbox participants test technologies in a controlled environment under direct BoU engagement. Data from sandbox trials informs the drafting of new guidelines and updates to existing law. At least one firm has been approved to test QR-based payment technology.

**Why Moat should apply:**

- Provides regulatory clarity on notification-based transaction capture, which currently sits in a policy grey area without explicit BoU guidance
- Establishes a formal BoU relationship needed for any future bank or MNO partnership — notification allowlisting, statement import agreements, or USSD access all require institutional trust
- Sandbox graduates have a faster path to licensing and formal product launch
- Positions the product correctly in the eyes of investors and institutional partners

**Timing**: Apply after Phase 1 (accounting core) is complete and before Phase 3 (parser and automated capture) is launched publicly. The product needs to be solid enough to demonstrate, but the application should precede scale.

Sources: [BoU sandbox announcement - Bitcoin.com](https://news.bitcoin.com/bank-of-uganda-launches-regulatory-sandbox-framework-one-fintech-firm-already-approved/), [BoU fintech commitment](https://www.bou.or.ug/), [Open banking sandboxes in Africa - Open Bank Project](https://www.openbankproject.com/blog/regulatory-sandboxes-in-africa/).

### 5.5.4 Financial Education Content Strategy

The Learn workspace exists but has no content strategy. Generic personal finance content is available everywhere. The product's durable advantage is local specificity — content that only works in Uganda, written for how money actually moves here.

**Uganda-specific content that no generic app provides:**

- How SACCOs work: what a legitimate SACCO looks like, how to use the UMRA licensed SACCO register before joining, red flags for unlicensed deposit-taking. UMRA's register is publicly available.
- How Treasury bills and bonds work: via the Uganda Securities Exchange primary auction, realistic minimum investment, how to open a CDS account, what the yield curve currently looks like
- CIS options: the difference between licensed collective investment scheme types under CMA Uganda (money market, equity, balanced), with current licensed fund list and approximate returns
- Reading a mobile money statement: how to identify agent fees, float charges, transaction levies, and withdrawal costs that many users absorb without realising
- ROSCAs and chamas vs. formal savings: the mathematics of each, when informal is genuinely better, and when formal savings products win
- Salary-plus-side-hustle tax: plain-language explanation of when you need to file, what counts as business income, and when to get an accountant
- URBRA pension: what mandatory NSSF contributions are, what happens to contributions when you change employer, how to check your balance

**Content governance requirements:**

- Each article must cite its source (URA, BoU, UMRA, CMA, USE, URBRA)
- Articles must be dated and flagged for annual review — regulatory details change
- Content should be stored as structured data (MDX or JSON), not hardcoded in components, so it can be updated without a code deployment
- Assign a content owner responsible for maintaining accuracy

Sources: [UMRA licensed SACCOs](https://umra.go.ug/), [CMA licensed CIS funds](https://cmauganda.co.ug/), [USE T-bills and bonds](https://use.or.ug/securities/bonds), [URBRA pension guidance](https://urbra.go.ug/), [NSSF Uganda](https://www.nssfug.org/).

## Future Outlook

The Uganda market direction is favorable for this product if it stays practical.

### Reason 1: Inclusion is still growing

MoFPED says the 2023-2028 strategy targets 85% inclusion by 2028, from 81% already recorded in FinScope 2023. That means more users will be moving into formal and semi-formal systems, but they will still need help organizing them. Source: [MoFPED NFIS update](https://www.finance.go.ug/media-center/news-and-updates/implementation-national-financial-inclusion-strategy).

### Reason 2: Usage is the next problem, not just access

The gap is shifting from “can I access a financial service?” to “am I using it well?” That is exactly where accounting, saving discipline, and investment routing fit.

### Reason 3: Long-term savings channels are deepening

Retirement and collective investment pools are growing, which means the app can eventually support more formal long-term planning workflows without pretending Uganda is already a full open-banking market.

## Recommended Build Sequence

### Before Anything Else (Phase 0 — Non-Negotiable)

1. Draft and publish a DPPA-compliant privacy policy.
2. Add in-app consent notice to onboarding before any data is stored.
3. Register with PDPO under NITA-U.
4. Add data export (JSON) and account deletion flows.
5. Implement PIN lock with PBKDF2-derived key and IndexedDB encryption.
6. Add session timeout and auto-lock.
7. Add encrypted backup download and restore.
8. Add `manifest.json`, service worker, and install prompt to make the app installable on Android.

### Phase 1 — Accounting Core (Parallel with Testing)

1. Add running balances and period opening/closing balances in ledger views.
2. Add reconciliation states per transaction: `draft`, `parsed`, `reviewed`, `posted`, `matched`.
3. Add payee/counterparty normalization and rule engine.
4. Add month close workflow: unresolved transactions, duplicate alerts, category review, export.
5. Begin unit and property-based tests for all `lib/domain/` functions.
6. Begin unit tests for the CSV parser.

### Phase 1.5 — Budget, Debt, and Data Model

1. Add monthly budget/envelope system with per-category allocation and real-time remaining balance.
2. Add debt tracker with principal, interest rate, lender type, repayment schedule, and payoff calculator.
3. Add `currency`, `originalAmount`, and `fxRateToUgx` fields to the `Transaction` type now (before migration is painful).

### Phase 2 — Simple Capture

1. Add Android share intent receiver for `text/plain` and web paste-to-app flow. **(Ship first — zero policy risk, builds parser training data.)**
2. Add Android notification listener companion with allowlist, local parser templates, and review queue.
3. Expand CSV import: saved column mappings, import templates per bank or wallet, reconciliation against existing records.
4. Add PDF statement parsing where possible.

### Phase 3 — Parser Engine

1. Build deterministic template parser: MTN MoMo, Airtel Money, first bank alert formats.
2. Add sender signature matching, app package matching, field confidence scoring.
3. Add LLM-assisted fallback for unknown formats (on-device or privacy-scoped cloud call).
4. Add deduplication against existing records.
5. Add explicit source metadata on each transaction: `manual`, `csv`, `notification`, `sms`.

### Phase 4 — SMS Inbox Track (Separate Policy Decision)

1. Evaluate and pursue BoU regulatory sandbox application.
2. Decide Play distribution path vs. direct APK path based on policy review.
3. If Play: apply for SMS exception under "SMS-based money management" category.
4. If non-Play or approved: implement direct SMS inbox reading with full allowlist, on-device parsing, and raw message retention controls.

### Phase 5 — Full Personal Accounting System

1. Add chart of accounts with account purpose flags: spending, savings, debt, investment, business.
2. Add journal-based posting model under the hood.
3. Add split transactions.
4. Add attachment support: receipt, statement, screenshot.
5. Add audit trail with creation source on every transaction.
6. Add household support transfers and shared household mode.
7. Add accrual-like reminders: school fees due, rent due, loan installment due.
8. Add long-term instrument tracking: T-bills, bonds, CIS, retirement.
9. Add salary-plus-side-hustle mode with income stream separation.

### Phase 5.5 — Tax, USSD, Regulatory, Education

1. Add URA-aligned category taxonomy and annual tax preparation export.
2. Add VAT threshold soft alert.
3. Apply to BoU regulatory sandbox (timing: after Phase 1 is solid).
4. Populate Learn workspace with Uganda-specific content: SACCOs, T-bills, CIS, ROSCA vs. formal savings, EFRIS, URBRA.
5. Assign a content owner and set annual review cadence.
6. Evaluate USSD partnership path once commercial traction is established.

### Later

1. Pursue direct inbox SMS reading if policy, privacy, and distribution strategy are fully aligned.
2. Build USSD shortcode layer via licensed PSP partnership.
3. Add optional encrypted cloud sync to user-controlled storage.
4. Add multi-currency conversion display and historical rate lookup.

## Architecture Recommendation for Automatic Capture

### Recommended Technical Shape

- Keep the main app data model as the source of truth.
- Add an `Ingestion` layer before posting transactions.
- Parse on-device first.
- Use a `review queue` between capture and ledger posting.

### Suggested Data Model Additions

**Capture pipeline:**

- `RawMessage`
  - source kind (`notification` | `sms` | `paste` | `share`)
  - sender / package
  - body
  - received at
  - hash (for deduplication)
  - parse status (`unparsed` | `parsed` | `failed`)
- `ParsedCandidate`
  - amount
  - direction
  - currency
  - balance if present
  - reference id
  - confidence score (0–1)
  - mapped account id
  - mapped category id
- `PostingDecision`
  - approved
  - rejected
  - merged
  - duplicate

**Budget system:**

- `Budget`
  - userId
  - month (YYYY-MM)
  - categoryId
  - allocatedAmount
  - currency (default UGX)

**Debt tracker:**

- `DebtRecord`
  - userId
  - accountId (links to existing `debt` type account)
  - principal
  - interestRate
  - interestType (`flat` | `reducing_balance`)
  - lenderType (`bank` | `sacco` | `microfinance` | `informal`)
  - startDate
  - termMonths
  - repaymentFrequency (`monthly` | `weekly` | `biweekly`)

**Multi-currency fields on `Transaction` (add now, convert later):**

- `currency: string` (default `"UGX"`)
- `originalAmount: number` (default equals `amount`)
- `fxRateToUgx: number | undefined`

**Security:**

- `EncryptedBlob` — used for backup files. Contains a PBKDF2-derived key salt, IV, and ciphertext of the full data export JSON.

### Why This Matters

This keeps the ledger clean. Raw capture and accounting records should not be the same object. The budget and debt models share the category and account abstractions already in place, which means the schema additions are small relative to the user value they unlock.

## Compliance and Trust Requirements

This product will handle financial and message-derived data. That means trust is a product feature, not just a legal task.

### Uganda Legal Obligations

| Requirement | Law | What It Means |
| --- | --- | --- |
| PDPO registration before collecting personal data | DPPA 2019, Section 29 | Register with PDPO under NITA-U before any public launch |
| Explicit consent before collection | DPPA 2019, Section 13 | In-app consent notice required; no pre-ticked boxes |
| Data subject access and deletion rights | DPPA 2019, Sections 19–22 | Provide export-all and delete-account flows |
| Retention limitation | DPPA 2019, Section 16 | Document and enforce a data retention policy |
| Consumer disclosure of fees | BoU FCPGs 2011 | Clearly disclose any charges before user commits |
| Non-misleading projections | BoU FCPGs 2011 | Label goal and investment calculations as estimates |
| Data communications standards | UCC Act 2023 | SMS/notification features must align with UCC framework |

### Minimum Controls for Message Capture

- prominent disclosure before any message capture is enabled
- explicit sender/app allowlist controls, user-configurable
- local-first parsing wherever possible; no raw message content sent to any server without separate explicit consent
- raw-message retention controls: store parsed fields and message hash; discard full body after parse unless user opts in
- export and delete controls for all captured data
- no silent background harvesting of non-financial messages
- clear explanation in plain language of what is read, why, and how it is used

## Final Recommendation

The next roadmap should be:

1. **legal and security baseline first** — DPPA registration, consent flows, PIN lock, encrypted storage, backup
2. **accounting quality second** — running balances, reconciliation states, budget and debt systems
3. **compliant capture third** — share intent from WhatsApp, then notifications, then parser templates
4. **SMS inbox access fourth** — only after Phase 1–3 are solid and BoU sandbox engagement is underway
5. **formal savings, investment routing, and tax alignment** after the accounting base is trustworthy

The most important strategic decisions are:

- Do not distribute publicly without PDPO registration and a privacy policy. This is a legal requirement, not a best practice.
- Do not build notification or SMS capture before the accounting core is correct. Imported errors at scale are harder to fix than manually entered ones.
- Build the WhatsApp share intent before everything else in the capture track. It has zero policy risk, generates real parser training data, and delivers immediate user value.
- Add multi-currency fields to the Transaction type now. This is a ten-minute data model change that prevents a painful migration later.
- Apply to the BoU regulatory sandbox after Phase 1. Uganda's financial infrastructure will open up — being a known participant in the regulatory process positions Moat to benefit from that.

Uganda already has enough signal in messages, notifications, and statements to build a world-class personal accounting product. The constraint is not data — it is trust, correctness, and regulatory standing. Build those first.

## References

### Android and Google Play Policy

- [Use of SMS or Call Log permission groups - Google Play](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en-EN)
- [NotificationListenerService - Android Developers](https://developer.android.com/reference/android/service/notification/NotificationListenerService.html)
- [StatusBarNotification - Android Developers](https://developer.android.com/reference/android/service/notification/StatusBarNotification.html)
- [Android 15 behavior changes - Android Developers](https://developer.android.com/about/versions/15/behavior-changes-all)
- [SMS Retriever overview - Google for Developers](https://developers.google.com/identity/sms-retriever/overview)
- [SMS User Consent overview - Google for Developers](https://developers.google.com/identity/sms-retriever/user-consent/overview)
- [Which SMS verification API should I use? - Google for Developers](https://developers.google.com/identity/sms-retriever/choose-an-api)
- [Receive content from other apps - Android Developers](https://developer.android.com/training/sharing/receive)

### Uganda Regulation and Legal Framework

- [Data Protection and Privacy Act 2019 - ULII](https://ulii.org/en/akn/ug/act/2019/9/eng@2019-05-03)
- [DPPA compliance guide - Securiti](https://securiti.ai/uganda-data-protection-and-privacy-act/)
- [Uganda Communications Commission - standards and regulations](https://www.ucc.co.ug/standards-regulations-guidelines-and-frameworks/)
- [Uganda Communications (Content) Regulations 2019 - UCC](https://www.ucc.co.ug/regulations-2019/)
- [SMS compliance guidance for Uganda - Sent.dm](https://www.sent.dm/resources/ug-sms-guidance)
- [Bank of Uganda Financial Consumer Protection Guidelines 2011](https://www.dfcugroup.com/wp-content/uploads/2021/11/Bank-of-Uganda-Financial-Consumer-Protection-Guidelines-2011.pdf)
- [UMRA Financial Consumer Protection Guidelines](https://umra.go.ug/financial-consumer-protection-guidelines/)
- [Uganda consumer protection regulatory landscape - UNCDF](https://policyaccelerator.uncdf.org/whats-new/navigating-ugandas-regulatory-landscape-consumer-protection-through-robust-legal-regulatory-frameworks)
- [Uganda National Payment Systems Act 2020 - BoU](https://www.bou.or.ug/bou/bou-downloads/financial-stability/legal-framework/2021/National-Payment-Systems-Act-2020.pdf)
- [Uganda VAT Act - ULII](https://ulii.org/en/legislation/act/2019/ug-act-2019-8)

### Bank of Uganda and Regulatory Sandbox

- [BoU Regulatory Sandbox announcement - Bitcoin.com](https://news.bitcoin.com/bank-of-uganda-launches-regulatory-sandbox-framework-one-fintech-firm-already-approved/)
- [Bank of Uganda official site](https://www.bou.or.ug/)
- [BoU exchange rate data](https://www.bou.or.ug/bou/rates_statistics/Rates/exchange_rates.html)
- [Open banking and regulatory sandboxes in Africa - Open Bank Project](https://www.openbankproject.com/blog/regulatory-sandboxes-in-africa/)

### Uganda Revenue Authority

- [URA EFRIS e-invoicing overview - ClearTax Uganda](https://www.cleartax.in/ug/e-invoicing-uganda)
- [Uganda Revenue Authority e-Returns](https://ura.go.ug/en/)

### Uganda Market Data and Financial Inclusion

- [Implementation of the National Financial Inclusion Strategy - MoFPED](https://www.finance.go.ug/media-center/news-and-updates/implementation-national-financial-inclusion-strategy)
- [National Financial Inclusion Strategy 2023-2028 - BoU](https://www.bou.or.ug/bouwebsite/bouwebsitecontent/FinancialInclusion/2023/Signed_2023_2028_National-Financial-Inclusion-Strategy_.pdf)
- [FinScope Uganda 2023 survey - FSD Uganda](https://fsduganda.or.ug/finscope-uganda-2023-survey/)
- [FinScope Uganda 2023 findings summary PDF - FSD Uganda](https://fsduganda.or.ug/wp-content/uploads/2024/04/FinScope-Uganda-2023-Findings-Summary.pdf)
- [Financial Inclusion Beyond Mobile Money - FSD Uganda](https://fsduganda.or.ug/financial-inclusion-beyond-mobile-money/)
- [DataReportal Digital 2025: Uganda](https://datareportal.com/reports/digital-2025-uganda)
- [Uganda Mobile Money Market 2024–2033 - IMARC](https://www.imarcgroup.com/uganda-mobile-money-market)

### USSD

- [Unpacking USSD technology in Uganda - FSD Uganda](https://fsduganda.or.ug/unpacking-the-world-of-ussd-technology/)
- [Alternatives to USSD in Uganda’s financial sector - FSD Uganda](https://fsduganda.or.ug/what-will-it-take-to-adopt-alternative-technologies-to-ussd-in-ugandas-financial-sector/)
- [USSD relevance in African fintech 2025 - MBU](https://mbu.ug/2025/06/12/ussd-relevance-fintech-africa-2025/)

### Capital Markets and Investment Products

- [CMA: Uganda’s collective investment scheme assets cross UGX 1 trillion](https://cmauganda.co.ug/2024/11/26/ugandas-collective-investment-scheme-assets-cross-ugx-1-trillion/)
- [CMA Capital Markets Quarterly Bulletin Q1 2025](https://cmauganda.co.ug/wp-content/uploads/2022/05/Capital-Markets-Quarterly-Bulletin-1Q-2025.pdf)
- [URBRA: Uganda’s retirement savings hit UGX 30 trillion](https://urbra.go.ug/2026/03/10/record-growth-sustainability-challenge-ugandas-retirement-savings-hit-ugx30-trillion/)
- [URBRA sector growth report](https://urbra.go.ug/2024/12/03/retirement-benefits-sector-records-growth-in-assets-and-interest-paid-to-savers/)
- [Uganda Securities Exchange debt instruments (T-bills and bonds)](https://use.or.ug/securities/bonds)
- [NSSF Uganda member guidance](https://www.nssfug.org/)

### SACCO and Microfinance

- [UMRA SACCO licensing guidelines](https://umra.go.ug/wp-content/uploads/2021/09/SACCO-GUIDELINES.pdf)
- [UMRA licensed SACCO and microfinance registry](https://umra.go.ug/)

### PWA and Web Platform

- [Web App Manifest - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Web Authentication API (WebAuthn) - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [PBKDF2 key derivation - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
- [Background Synchronization API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Workbox PWA toolkit - Google Chrome Developers](https://developer.chrome.com/docs/workbox/)

### Testing

- [Vitest documentation](https://vitest.dev/)
- [fast-check property-based testing](https://fast-check.io/)

---

## iOS Platform Reality and Strategy

The previous sections of this roadmap assumed Android as the primary mobile target. That assumption is correct for Uganda's general population — Android holds approximately 82% of the OS market. However, the product owner and likely a segment of the early user base are on iOS. iOS requires a separate, explicit strategy because several of the assumptions in this document do not apply there.

### What iOS Allows

**PWA on iOS (Safari):**

iOS Safari supports web app installation via "Add to Home Screen" since iOS 11.3. As of iOS 16.4, installed PWAs on iOS support Web Push notifications and the Web App Manifest `display: standalone` mode. The install trigger on iOS is different from Android: there is no `beforeinstallprompt` event. The user must manually navigate to Safari's share sheet and tap "Add to Home Screen." The app cannot detect whether the user has installed it programmatically.

As of iOS 17.4, Apple was required by the EU Digital Markets Act to allow alternative browser engines on EU devices. Outside the EU, Safari/WebKit remains the only engine on iOS, meaning all browser-based apps — including the Moat PWA — run on WebKit regardless of which browser the user opens them in.

**IndexedDB on iOS:**

IndexedDB is supported on iOS Safari since iOS 10. The implementation has historically had quirks — particularly around storage limits and background termination — but modern iOS (15+) is substantially more reliable. The most important iOS-specific constraint is **storage eviction**: iOS aggressively evicts PWA storage when the device is under storage pressure, and a PWA that has not been used recently may have its IndexedDB wiped. This makes the encrypted backup/restore flow (Phase 0.3) even more critical on iOS than on Android.

**Web Crypto API:**

Fully supported on iOS Safari 11+. PBKDF2 key derivation, AES-GCM encryption, and the full `crypto.subtle` API work on iOS. The PIN lock and encrypted backup architecture described in Phase 0 will work on iOS.

**Background Sync:**

The Web Background Sync API is **not supported on iOS Safari** as of 2025. This is a material limitation: transactions entered offline on iOS will not automatically sync in the background when connectivity returns. The fallback is to sync on next app open. The service worker on iOS does not run in the background the way it does on Android Chrome.

**Web Push Notifications:**

Supported on iOS 16.4+ for installed PWAs (added to home screen) only. Not available in Safari browser tabs. This means goal reminders and savings alerts via push require the user to have installed the app to their home screen. Uninstalled users cannot receive push on iOS.

**Share Extension (share-to-app from WhatsApp):**

iOS does not support Android-style intent filters. A web app on iOS cannot register as a target for the share sheet. This means the WhatsApp share-to-app flow described in Phase 2.1 **does not work on iOS as a PWA**. The iOS equivalent requires a native app with a Share Extension, which is a separate App Store submission.

**The iOS-viable alternative for text capture** is the paste-to-app flow: the user copies a transaction confirmation from WhatsApp and pastes it into a dedicated input in Moat. This works on all platforms with no permissions or native code required and should be the primary capture path for iOS users.

### iOS-Specific Constraints Summary

| Feature | Android (PWA) | iOS (PWA) | Notes |
| --- | --- | --- | --- |
| Install to home screen | Auto-prompted via `beforeinstallprompt` | Manual only (share sheet → Add to Home Screen) | No install prompt API on iOS |
| Web Push notifications | Supported in all Chrome PWAs | Installed PWA only (iOS 16.4+) | Must be added to home screen first |
| Background Sync | Supported | Not supported | Sync on next open as fallback |
| IndexedDB | Stable | Stable but eviction risk | Backup/restore is critical on iOS |
| Web Crypto / encryption | Supported | Supported (iOS 11+) | Full parity |
| Share intent receiver | Via Android intent filter | Not available in PWA | Requires native Share Extension |
| Paste-to-app intake | Supported | Supported | Works identically on both |
| Camera / QR scan | Supported | Supported (iOS 14.3+) | Full parity |
| SMS inbox reading | Via READ_SMS permission (Android) | Not available to any app | iOS blocks all SMS inbox access |
| Notification listener | Via NotificationListenerService (Android) | Not available | iOS does not expose notification content to third-party apps |

### iOS and Automated Transaction Capture

This is the most significant divergence from the Android roadmap. On iOS:

- There is **no access to the SMS inbox** from any app, including native apps distributed through the App Store. Apple does not provide this API.
- There is **no notification listener service**. iOS does not expose the content of notifications from other apps to third-party apps. An app cannot read what an MTN MoMo notification says.
- The SMS Retriever and User Consent APIs are Android-only. They do not exist on iOS.

This means the entire capture automation roadmap (Phase 2.2 notification capture, Phase 4 SMS inbox reading) is **Android-only**. iOS users cannot benefit from these features without manual action.

**What iOS users can do instead:**

1. **Paste-to-app**: Copy a transaction confirmation from any app and paste it into Moat's ingestion input. This triggers the same parser pipeline as the share intent.
2. **Shortcuts automation (advanced)**: iOS Shortcuts app can be configured by the user to extract text from notifications and send it to a URL (Moat's ingestion endpoint or a clipboard listener). This is user-configured, not app-controlled, and requires technical willingness. It cannot be automated from the app side.
3. **CSV import**: Periodic statement imports from mobile banking apps that export CSV remain the most reliable import path for iOS users.
4. **Manual entry**: The app is already optimized for this and must remain fast and low-friction for users who rely on it as the primary path.

### How to Think About iOS in the Product Strategy

There are two distinct user groups:

**Group 1 — Power users and the product owner (iOS)**

These users will likely be the most engaged, most vocal, and most likely to give quality feedback. They will use manual entry, paste-to-app, and CSV imports. They need the core accounting product (Phases 0–1.5) to be excellent. The fact that they cannot use the capture automation does not reduce their value — it increases the urgency of making manual entry and CSV import as good as possible.

**Group 2 — General Ugandan market users (Android-first)**

These users benefit from the full capture roadmap — share intent, notification listener, eventually SMS reading. This is where the automation value is concentrated.

The correct product architecture serves both groups from the same codebase, with capture features gracefully absent on iOS rather than broken. The paste-to-app flow is the natural bridge: it works on both platforms, requires no permissions, and produces the same parser output as the Android share intent.

### iOS App Store Path (Future)

A native iOS app is not required in the near term. The PWA covers the core accounting use case adequately. However, if the product ever wants to offer:

- Share Extension (receive text from WhatsApp on iOS)
- Push notifications to non-installed users
- Face ID / Touch ID lock beyond what WebAuthn provides in Safari
- Background processing beyond what the service worker supports

...then a native Swift/SwiftUI app or a React Native / Capacitor wrapper submitted to the App Store becomes necessary. This is a later-stage decision contingent on user demand and distribution strategy.

Sources: [Web Push for Web Apps on iOS and iPadOS - WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [PWA compatibility on iOS - MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [iOS Share Extension - Apple Developer](https://developer.apple.com/documentation/foundation/app_extension_support/sharing_data_with_your_containing_app), [iOS Shortcuts documentation - Apple](https://support.apple.com/guide/shortcuts/welcome/ios), [Web Background Sync - MDN compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API#browser_compatibility), [EU DMA and browser engines on iOS - Apple](https://developer.apple.com/support/alternative-browser-engines/).

---

## Architecture Review: What Is Good, What Is Fragile, and What Must Change

This section reviews the current implementation architecture directly. It is based on reading the actual source code, not assumptions.

### What the Current Architecture Gets Right

**1. The Repository pattern is correctly implemented and is the most important architectural decision in the codebase.**

`RepositoryBundle` in `lib/repositories/types.ts` defines clean interfaces for every store. The IndexedDB implementation satisfies those interfaces. This means swapping the storage backend — from IndexedDB to SQLite (via Capacitor), a remote Postgres, or a service worker cache — requires only a new factory function passed to the components. No component touches IndexedDB directly.

This is the correct shape for a local-first application that may eventually grow a backend.

**2. Domain logic is cleanly separated from storage and UI.**

`lib/domain/accounts.ts`, `lib/domain/goals.ts`, and `lib/domain/summaries.ts` are pure functions that take data and return computed results. They have no side effects, no storage calls, and no UI imports. This is what makes them testable — and some tests already exist.

**3. `createBootstrapState` is a good pattern for initial data seeding.**

Generating all default categories, resource links, and investment profile in one pure function keeps the onboarding flow clean and makes the initial state predictable and testable.

**4. The event bus for local save feedback (`announceLocalSave`) is a sensible micro-pattern.**

Using a `CustomEvent` on `window` to broadcast save events means components can independently show save confirmation without prop-drilling or shared state. For a single-user local app, this is proportionate.

---

### Critical Architectural Problems

**Problem 1: `listByUser` does a full table scan on every query.**

```ts
async listByUser(userId) {
  const records = await readAll<T>(storeName);
  return records.filter((record) => record.userId === userId);
}
```

`readAll` fetches every record in the store, then filters in JavaScript. There are no IndexedDB indexes. This means:

- Fetching 1 transaction and fetching 10,000 transactions costs the same database round-trip.
- Every workspace load reads the entire transactions store into memory.
- `listByMonth` calls `listByUser` first, loading all transactions, then filters by month.

At 500 transactions this is imperceptible. At 5,000 (one year of active use) it becomes slow. At 20,000 (multiple years or CSV imports) it becomes genuinely painful, especially on a 3–4 GB RAM Android device.

**The fix**: Add a `userId` index to each object store at database creation time. IDB indexes enable `getAll(IDBKeyRange.only(userId))` which is handled at the database level, not in JavaScript. This requires a database version bump and a migration step in `onupgradeneeded`.

```ts
// In createStores:
const txStore = database.createObjectStore("transactions", { keyPath: "id" });
txStore.createIndex("userId", "userId", { unique: false });
txStore.createIndex("userId_occurredOn", ["userId", "occurredOn"], { unique: false });
```

**Problem 2: `DATABASE_VERSION` is hardcoded at `1` with no migration path.**

```ts
const DATABASE_VERSION = 1;
```

The current `onupgradeneeded` only creates stores if they do not exist. There is no version-switch logic, no migration runner, and no way to add indexes or change store definitions on existing installations without wiping the database.

When the roadmap items (multi-currency fields, debt records, budget targets, capture pipeline stores) require schema changes, this becomes a breaking problem for existing users.

**The fix**: Implement a versioned migration runner in `onupgradeneeded`:

```ts
request.onupgradeneeded = (event) => {
  const db = request.result;
  const oldVersion = event.oldVersion;
  
  if (oldVersion < 1) { /* create initial stores */ }
  if (oldVersion < 2) { /* add userId indexes */ }
  if (oldVersion < 3) { /* add currency field default, add rawMessages store */ }
};
```

Each migration step runs only for users upgrading from an older version. New installs run all steps from 0.

**Problem 3: `repositories` is instantiated at module level in every workspace file.**

```ts
// At the top of transactions-workspace.tsx, goals-workspace.tsx, etc.:
const repositories = createIndexedDbRepositories();
```

This creates a new `RepositoryBundle` — and a new `IDBDatabase` connection — for every mounted workspace. On a page where multiple workspaces could be active, this creates redundant database connections. More importantly, it makes testing impossible without mocking the module.

**The fix**: Create one `RepositoryBundle` at application root and pass it via React context, or create a single module-level singleton in a dedicated `lib/repositories/instance.ts`. Any approach that creates it once is better than the current pattern.

```ts
// lib/repositories/instance.ts
import { createIndexedDbRepositories } from "./indexeddb";
export const repositories = createIndexedDbRepositories();
```

**Problem 4: Balance is stored as a computed field on `Account` and re-computed redundantly.**

```ts
export type Account = {
  balance: number; // stored in IndexedDB
  ...
};
```

`reconcileAccountBalances` recomputes balance from `openingBalance + sum(transactions)` correctly, and then `upsert`s the result back to the store. But the `balance` field in IndexedDB is not the source of truth — it is a derived cache. This causes several problems:

- If a transaction is deleted without re-running reconciliation, the stored balance is stale.
- Any code that reads `account.balance` without first running reconciliation gets a potentially wrong number.
- The current workspaces call `reconcileAccountBalances` followed by `upsert` for each account on every load, which is correct but expensive.

**The better model**: Do not store `balance` at all. Compute it on demand from `openingBalance + sum(transactions for this account)`. With a proper `userId` index on transactions and a compound `[accountId, occurredOn]` index, this is a fast indexed query. The account store becomes the source of truth for metadata; the transaction store is the source of truth for movement.

If caching balance is needed for performance (e.g., dashboard), cache it in React state derived from the query result, not in the database.

**Problem 5: `savings` and `net` in `MonthSummary` are the same value.**

```ts
const savings = inflow - outflow;
// ...
return {
  savings,
  net: savings, // identical
};
```

`net` and `savings` are the same computation. `allocatedSavings` is a different concept (explicitly tagged savings contributions) but is not used to calculate `savings`. This is semantically confusing: a user can have high `savings` (inflow > outflow) and zero `allocatedSavings` (nothing explicitly tagged), which the insights engine correctly flags but the data model does not cleanly express.

The correct model separates:
- `surplus`: inflow − outflow − savings_contributions (money left over after explicit savings)
- `allocatedSavings`: explicitly tagged savings_contributions
- `net`: inflow − outflow (total change in spending accounts)

**Problem 6: Goal `currentAmount` is manually entered, not derived from transactions.**

```ts
export type Goal = {
  currentAmount: number; // set in the form
};
```

The user types in how much they have saved toward a goal. This is completely disconnected from the `savings_contribution` transactions in the ledger. A user can log fifty savings contributions to an account linked to a goal and `currentAmount` stays at whatever they last typed.

The old code had `applyGoalTransactions` — this was recently removed in a refactor and the `goals-workspace.tsx` now just saves what the user enters. This means the goal progress is manual fiction unless the user keeps it updated.

**The correct model**: Derive `currentAmount` from the sum of `savings_contribution` transactions whose `accountId` matches `goal.linkedAccountId`, filtered to transactions dated after `goal.createdAt`. `currentAmount` should never be stored — it should always be computed. Store it only as a cache if performance requires it, invalidated on any transaction change.

---

### Data Model Gaps

The following are gaps in `lib/types.ts` that will cause pain when the roadmap features are built:

**1. `Transaction` has no `reconciliationState`.**

The roadmap calls for `draft | parsed | reviewed | posted | matched` states. Without this field, the review queue and reconciliation inbox have no field to operate on. Add now:

```ts
export type ReconciliationState = "draft" | "parsed" | "reviewed" | "posted" | "matched";

export type Transaction = {
  // ...existing fields...
  reconciliationState: ReconciliationState; // default "posted" for manual entries
  source: "manual" | "csv" | "notification" | "sms" | "paste"; // default "manual"
};
```

**2. `Transaction` has no `payee` / counterparty field.**

Mobile money transactions always have a counterparty — the person paid, the agent used, the business billed. Without a `payee` field, the payee normalization and rule engine described in Phase 1 have nowhere to write their output.

```ts
export type Transaction = {
  // ...
  payee?: string; // normalized name of the counterparty
  rawPayee?: string; // original string before normalization
};
```

**3. `UserProfile.currency` is hardcoded to `"UGX"`.**

```ts
currency: "UGX"; // literal type, not a string
```

This is a type-level hardcoding that blocks multi-currency at the profile level. It should be `currency: string` with `"UGX"` as the default, or `currency: "UGX" | "USD" | "KES"` as an explicit union.

**4. `Goal` has no `contributionAccountIds` list.**

The current `linkedAccountId?: string` allows linking one account to a goal. In practice, a user might contribute to an emergency fund from their salary account and their mobile money account. A single link misses multi-source savings.

```ts
export type Goal = {
  // ...
  linkedAccountId?: string; // keep for display/primary account
  contributionAccountIds?: string[]; // for derivation of currentAmount
};
```

**5. `Category` has no `updatedAt` field.**

Every other entity has `createdAt` and `updatedAt`. `Category` only has `createdAt`. This breaks any sync or backup/restore strategy that uses timestamps to detect which records changed.

**6. `ImportBatch` has no `sourceType` or `status` field.**

```ts
export type ImportBatch = {
  sourceName: string; // e.g., "transactions.csv"
  rowCount: number;
};
```

There is no way to distinguish a CSV import from a future notification batch or SMS parse run. No status to indicate whether the import completed, partially failed, or was reversed. Add:

```ts
export type ImportBatch = {
  // ...
  sourceType: "csv" | "pdf" | "notification" | "sms" | "paste";
  status: "complete" | "partial" | "failed" | "reversed";
  errorCount?: number;
};
```

**7. No `RawMessage` or `ParsedCandidate` types exist yet.**

These are needed for Phase 2/3 and should be defined now so the parser architecture has a stable target. Already specified in the Architecture Recommendation section of this document — they need to be added to `lib/types.ts`.

**8. `MonthlyInsight` is `Omit<MonthlyInsight, "userId">` throughout `insights.ts`.**

Every function in `lib/domain/insights.ts` returns `Omit<MonthlyInsight, "userId">[]`. The `userId` is added at the callsite. This is a leaky abstraction — the domain function should either take a `userId` and return complete `MonthlyInsight[]`, or the type should be split into `InsightTemplate` (no userId) and `MonthlyInsight` (with userId). The current pattern will cause mistakes when insights are stored to IndexedDB.

---

### What Should Be Refactored Now vs. Later

**Refactor now (before adding new features):**

1. Move `repositories` from module-level in workspaces to a single shared instance or React context.
2. Add `userId` index to all IndexedDB object stores (requires `DATABASE_VERSION = 2` and migration).
3. Add `reconciliationState` and `source` to the `Transaction` type with defaults, so new manual transactions are correctly tagged from the start.
4. Fix `MonthSummary.net` / `MonthSummary.savings` duplication — clean up the semantic confusion before the budget system is built on top of it.
5. Add `updatedAt` to `Category`.

**Refactor in Phase 1.5 (when budget and debt are built):**

6. Remove stored `balance` from `Account` or clearly document that it is a cache, not a source of truth, and enforce that it is always recomputed on load.
7. Fix `Goal.currentAmount` to be derived from transactions, not manually maintained.
8. Add `payee` and `rawPayee` to `Transaction`.

**Refactor later (when multi-user or sync is needed):**

9. Replace `UserProfileRepository.get()` (which just returns `profiles[0]`) with a proper profile-by-id lookup — the single-user assumption is baked in here and will need to be broken for household mode.
10. Add a proper migration runner to `onupgradeneeded`.

---

### Scalability Assessment

The current architecture is well-structured for a single-user local-first app up to approximately 5,000 transactions. Beyond that, the full-table-scan `listByUser` pattern becomes a user experience problem. The stored `balance` cache and the missing indexes are the two technical debts most likely to cause visible performance degradation as the data grows.

The good news is that the repository abstraction is the right shape for what comes next. Adding indexes, replacing the IndexedDB backend with a SQLite backend via Capacitor, or eventually syncing to a remote Postgres instance — all of these are contained changes that do not touch the domain layer or the components. That is the correct property for a local-first architecture to have.

---

### iOS and Architecture in the Roadmap Build Sequence

Adding to the existing Phase 0 and Phase 1 tasks:

**Phase 0 additions for iOS:**

- Make the paste-to-app ingestion input the primary capture fallback on all platforms (not just Android)
- Test PWA installation flow on iOS Safari explicitly — the install path is manual and non-obvious, and the app should surface instructions specifically for iOS users
- Verify IndexedDB storage behaviour on iOS and add a "storage health check" that warns when available quota is low
- Ensure the encrypted backup/restore flow is prominently surfaced on iOS, where storage eviction risk is higher than on Android

**Phase 1 architecture refactors (add to existing list):**

- Move `repositories` to a shared instance
- Add `userId` indexes to IndexedDB stores and bump `DATABASE_VERSION` to 2
- Add `reconciliationState` and `source` to `Transaction`
- Fix `Category` missing `updatedAt`
- Fix `MonthSummary.net` / `savings` duplication

### iOS References

- [Web Push for Web Apps on iOS and iPadOS - WebKit Blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Making PWAs installable - MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [iOS Share Extension - Apple Developer](https://developer.apple.com/documentation/foundation/app_extension_support/sharing_data_with_your_containing_app)
- [iOS Shortcuts app documentation - Apple](https://support.apple.com/guide/shortcuts/welcome/ios)
- [Web Background Sync API browser compatibility - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API#browser_compatibility)
- [EU DMA alternative browser engines on iOS - Apple Developer](https://developer.apple.com/support/alternative-browser-engines/)
- [IndexedDB on iOS Safari quirks - web.dev](https://web.dev/articles/storage-for-the-web)
