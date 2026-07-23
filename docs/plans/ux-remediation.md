# Moat — UX Remediation Plan (screens, copy, forms, widgets, logic)

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Remediation plan — execution tracker |
| Owner | Piira |
| Last Updated | 2026-07-23 |
| Scope | Every route, screen, form, sheet, and widget; user-facing copy; UX-visible logic |
| Sources | 3 code audits (copy / feature-relevance / forms-widgets) + seeded-browser visual pass of all 17 routes (mobile 402px + desktop 1440px) |

## How to use this document

Work phase by phase. Mark each item ✅ with the commit hash when done. An item is done only when its **Fix** is implemented *and* the phase exit criteria pass. Nothing may be dropped silently — if an item is rejected, mark it ❌ with a one-line reason instead of deleting it.

**Verification harness:** seed a browser via the CDP tour (seed dataset: 1 profile, 4 accounts, 12 transactions, 8 categories, 2 goals, 3 budgets — see git history of `scratchpad/seed.js` pattern) and re-screenshot affected routes mobile-first. All phases: `npx tsc --noEmit && npm run lint && npm run test && npm run build` green.

---

## Phase 0 — Trust-breaking bugs (do first)

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 0.1 | App renders **blank forever for any user without a PIN** — `PinLockGate` lost the `no_pin` branch in the unlock-animation rewrite; `showApp` only covered `unlocked`/`unlocking` | `components/pin-lock-gate.tsx` | `showApp` includes `no_pin` | ✅ fixed (uncommitted, verify + commit with Phase 0) |
| 0.2 | **Budget coverage math wrong**: summary "Spent"/"Remaining" compares allocation of *budgeted categories only* against **all** monthly spending → red "Remaining −1,270,000" even when every envelope is under budget | `lib/domain/budgets.ts:67-88` (`getBudgetCoverage`) | Count only spending in budgeted categories for the summary block (per-envelope rows at `:49` are already correct); add regression test | |
| 0.3 | **“−400%” savings rate** rendered as the giant hero stat; “Saved −USh 1,400,000 · −150%” double-negative framing | `components/dashboard/*` savings-rate stat (dashboard-sections / savings overview) | Clamp/reframe extreme values (e.g. below −100% → "Spent 5× income this period"); never headline a raw percentage beyond ±100% | |
| 0.4 | Settings claims PIN uses **PBKDF2**; it is Argon2id since the key-hierarchy migration — stale, contradicts the section header two cards above | `components/settings/pin-lock-panel.tsx:89-90` | Drop the algorithm name entirely: "Your PIN never leaves this device." | |
| 0.5 | Privacy policy contact is a non-routable placeholder `privacy@moat.local`; "Last updated 06-04-2026" is ambiguous DD-MM vs MM-DD | `app/privacy/page.tsx:14-16` | Real address (or remove until one exists); unambiguous date ("4 June 2026") | |
| 0.6 | Settings footer absolutist claim "never transmitted to any server" sits beside a Hosted-sync panel that contradicts it | `components/settings-workspace.tsx:109-110` | Reword to match reality ("stays on this device unless you turn on sync or cloud backup") | |

Exit criteria: regression test for 0.2; fresh-profile browser shows a working app with no PIN; screenshots of dashboard show no ±>100% headline stat.

---

## Phase 1 — Destructive-action safety & feedback

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 1.1 | **Zero confirmation on any delete** — one tap permanently deletes a transaction / goal / budget | `components/transactions/transaction-list.tsx:145-152` → `use-transactions-workspace.ts:492`; `components/goals/goal-list.tsx:89-96` → `use-goals-workspace.ts:148`; `components/budgets/budget-manager-panel.tsx:281-289` → `use-budget-planner.ts:88` | AlertDialog confirm on all three (model: delete-account panel’s pattern) | |
| 1.2 | Workspace `error` renders at frame level **behind the open sheet** — a validation failure keeps the sheet open showing nothing | `components/transactions-ledger-workspace.tsx:100-125`, `components/transactions-capture-workspace.tsx:78-84` | Render error inside the embedded form/sheet | |
| 1.3 | `LocalSaveFeedback` suppressed exactly when `embedded` (i.e. inside sheets) — in-sheet saves are silent | `components/transactions/transaction-form.tsx:98-104`, `components/goals/goal-form.tsx:84-90` | Keep a compact save indicator in embedded mode | |
| 1.4 | No toast system at all; only global surface is `PwaStatus` (top of page, usually behind a sheet, only shows in some states) | `components/pwa-status.tsx:96-111` | Add one lightweight toast/sonner surface for save/delete/error feedback app-wide | |
| 1.5 | **Swallowed errors** — `try/finally` with no catch: budget save/delete, month close, capture-automation settings write | `components/transactions/use-budget-planner.ts:47-72,88-100`; `use-transactions-workspace.ts:567-582` (`closeMonth`); `components/settings/capture-automation-panel.tsx:52-56` | Add catch → surface error to user | |
| 1.6 | Capture "manual" sheet stays open and silently resets after save (deliberate rapid-entry, but reads as "nothing happened") | `components/transactions-capture-workspace.tsx:114-167` | Inline "Saved ✓" line/toast on each save | |
| 1.7 | Numeric coercions silently turn garbage into 0 (budget target, expected amount, due day, rule priority) — user never sees a rejection | `use-budget-planner.ts:60-61`; `recurring-obligations-panel.tsx:187-189`; `transaction-rules-panel.tsx:223` | Validate + field error instead of `|| 0` fallback | |

Exit criteria: deleting anything asks first; every save/failure produces visible feedback with sheets open; grep shows no bare `try/finally` around repository writes in components.

---

## Phase 2 — Validation

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 2.1 | **Onboarding profile step never validated** — blank `displayName` and `consentGiven=false` pass (Continue is `type="button"`, `getStepError` has no `profile` branch, final submit re-checks only goal+security) | `components/onboarding/use-onboarding-workspace.ts:229-266,352-363`; `components/onboarding-workspace.tsx:219`; `components/onboarding/profile-step.tsx:57,169` | Add `profile` branch: require `displayName.trim()` + consent | |
| 2.2 | Account opening balance accepts NaN/negative/absurd (`Number()` unguarded; onboarding checks only `isFinite`) | `components/accounts/use-accounts-workspace.ts:76-79`; `components/accounts/account-form.tsx:123-130`; `use-onboarding-workspace.ts:234-237` | Reject NaN; negative only for `debt` type; field-level message | |
| 2.3 | Goal form: `targetAmount` can be 0/negative/NaN; `currentAmount` may exceed target; priority `min/max` are dead props on a text input; `targetDate` optional and allows the past | `components/goals/use-goals-workspace.ts:107-110`; `components/goals/goal-form.tsx:149-165` | Validate target>0, clamp priority (real number input), require non-past date | |
| 2.4 | Manual transaction posts with empty `accountId`/`categoryId` (only transfer path checks accounts; only amount>0 guarded) | `components/transactions/transaction-builder.ts:30-35,72-77,112-129` | Require account + category before build | |
| 2.5 | No field-level error marking anywhere — shared fields never wire `aria-invalid`; errors are generic strings far from the field | `components/forms/input-field.tsx:14-21`, `components/forms/select-field.tsx` | Add `error` prop to `InputField`/`SelectField` (message + `aria-invalid` + focus-first-invalid) | |
| 2.6 | Recurring obligation `dueDay` unbounded (45 accepted) | `components/transactions/recurring-obligations-panel.tsx:187-189` | Clamp 1–31 with message | |

Exit criteria: each form rejects its garbage inputs with a message *at the field*; onboarding cannot complete blank; unit tests for 2.2–2.4 validators.

---

## Phase 3 — De-scope surfaces the product can’t deliver (web)

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 3.1 | **Hosted sync UI with no real backend** — endpoint field, bearer token, "Sync now", auto-drain against a dev-only 501 stub ("DEV-ONLY BACKEND", env-flag gated, single-process JSON store, no tenancy). Placeholder `https://sync.example.com` visible | `components/settings/sync-mode-panel.tsx` (esp. `:143-149,211,215-222`); `app/api/v1/sync/push/route.ts`, `pull/route.ts`; `lib/sync/hosted-store.ts` | Hide Hosted-sync mode behind a build/env flag until a real backend ships; keep outbox plumbing (it is sound and tested) | |
| 3.2 | `/settings/sync-conflicts` — unreachable dead weight until 3.1 ships; renders raw `JSON.stringify` payloads, `entityType:entityId`, "Strategy/Operation" — a developer debug view | `components/sync-conflicts-workspace.tsx:141-181` | Gate with 3.1; when it returns, redesign as human diff ("Keep mine / Use server") without raw JSON | |
| 3.3 | **Android-only "Capture automation" section rendered for web users** — notification allowlist with raw package names (`com.mtn.uganda.momo`…), Allowed/Blocked rows, and literal dev contract text "Native bridge contract: `window.moatNativeCapture.ingest(payload)`" | `components/settings-workspace.tsx:70-76`; `components/settings/capture-automation-panel.tsx:65-67,82,110-114` | Render only when `hasNativeStorageBridge()`; delete the bridge-contract line from UI everywhere | |
| 3.4 | Google Drive "Connect" always shown; throws "not configured for this environment" when `NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` unset | `components/settings/backup-panel.tsx` (`getGoogleDriveClientId` path) | Hide/disable the card when unconfigured | |
| 3.5 | `navItems` (desktop nav) omits `/privacy` while `navIcons` includes it — Privacy reachable only from mobile drawer | `components/navigation/navigation-shared.tsx:42` vs `lib/data.ts` | Reconcile (footer link on desktop is enough; make it deliberate) | |
| 3.6 | "Changes stay on this device until sync exists." — admits unbuilt feature in Compass profile card | `components/investment-compass/*` (Local save chip copy) | Reword: "Saved on this device." | |

Exit criteria: web build shows no Android controls, no sync endpoint/token fields, no dev contract strings; drive card hidden without client id.

---

## Phase 4 — Screen usability (visual-pass findings)

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 4.1 | **Ledger rows truncate the payee to ~8 chars on mobile** ("Taxi sta…", "Greenh…", "Minis…") — space eaten by redundant EXPENSE/INCOME chip (arrow icon already encodes it) and always-visible edit+delete icons | `components/transactions/transaction-list.tsx` row layout (`:78-153`) | Drop the type chip; actions behind row tap (edit sheet) or swipe; payee gets full width | |
| 4.2 | **Same 6-row summary card duplicated on 3–4 transaction routes** (Recorded/This month/Needs review/Duplicates/Inflow/Outflow), irrelevant on Capture/Review; zero rows shown as noise | Transactions frame (`components/transactions-*-workspace.tsx`) | Show once on Ledger; elsewhere a one-line contextual count; hide zero rows | |
| 4.3 | Review screen **double-reports emptiness** — "UNRESOLVED 0 / DUPLICATES 0 / MISSING OBLIGATIONS 0" stat blocks AND the same three as "None" lists; raw lowercase "STATE ready" | `components/transactions/month-close-panel.tsx` | One combined "All clear for July" state; humanize state labels | |
| 4.4 | Long always-visible create forms parked on pages (Recurring obligations on Review; rules/budget on Tools) while the rest of the app uses summoned sheets | `recurring-obligations-panel.tsx`, `transaction-rules-panel.tsx`, `budget-manager-panel.tsx` | "Add …" button → sheet, matching accounts/goals pattern | |
| 4.5 | Account form sheet: full-screen takeover with dead half-screen below a small left-aligned button | `components/accounts/account-form.tsx` sheet + `FormCardShell` usage | Sheet hugs content; primary button full-width pinned at bottom | |
| 4.6 | Tap targets below 44px: 28px (`icon-sm`) edit/delete in every list, 32px (`h-8`) inputs/selects, `h-7` buttons | `components/ui/input.tsx`, `ui/select.tsx:47`; `transaction-list.tsx:136-153`, `account-list.tsx:103-111`, `goal-list.tsx:80-99` | ≥44px hit areas on touch (padding/hit-slop, not necessarily visual size) | |
| 4.7 | "Types 4 / 6" stat on Accounts — meaningless completionism | `components/accounts-workspace.tsx` summary | Cut; leave Total balance + account count | |
| 4.8 | Capture page is a menu-of-menus (route → method card → form = 3 hops for the most frequent action) | `components/transactions-capture-workspace.tsx:32,75` | Default-open Manual entry; methods as tabs/segments, not stacked cards | |
| 4.9 | Review sub-tabs "Month close / Capture inbox / Open capture inbox" — same label as both tab and button; two review queues confuse ("Review" vs "review/capture") | `components/transactions/*review*`, `transactions-route-links.tsx` | One "Review" inbox UX with sections, or rename clearly ("Month close" vs "Captured items") | |
| 4.10 | Dashboard: Inflow/Outflow/Saved as three stacked full-width cards of mostly empty space (mobile) | `components/dashboard/dashboard-sections.tsx` | One compact 3-stat row | |
| 4.11 | Top-spending rows use colored band fills (Rent green, School fees olive) that read as semantic (green=good?) not proportional | `components/dashboard/*top-spending*` | Neutral proportional bars, one hue | |
| 4.12 | "Ledger" chip repeated on every account row (Accounts + dashboard balances lists) | `components/dashboard/dashboard-sections.tsx:478`; accounts list | One affordance (row chevron → detail); drop per-row chip | |
| 4.13 | Chart mode tabs "Rate | Flow | Alloc" — cryptic; "Savings alloc." abbreviation in account breakdown | dashboard savings overview; `account-balance-breakdown.tsx` | Full words: "Savings rate / Cash flow / Allocation"; "Saved to goals" | |
| 4.14 | Module cards at page bottom all carry an "Active" chip — status that never varies is noise | `lib/data.ts` modulePreviews `stage`; home overview | Drop the chip (or only show non-default states) | |
| 4.15 | Goals header pattern differs (MOAT eyebrow + page name) from Home (wordmark only) — header inconsistency across routes | `components/page-shell/*`, workspace headers | One header pattern everywhere | |
| 4.16 | Monthly target shows odd precision ("USh 295,833") | `components/goals/goal-list.tsx` | Round display to nearest 1,000 | |

Exit criteria: re-screenshot all affected routes at 402px — no truncated payees, no duplicate summary, all tap targets ≥44px, forms summoned not parked.

---

## Phase 5 — Copy: jargon, wordiness, terminology, tone (full audit list — nothing omitted)

### 5A. Jargon → plain language (every instance)

| # | String | Location | Status |
| --- | --- | --- | --- |
| 5A.1 | "Argon2id" | `settings-workspace.tsx:64` | |
| 5A.2 | "PBKDF2" (also stale — see 0.4) | `pin-lock-panel.tsx:89-90` | |
| 5A.3 | "allowlisted sources … machine-derived records" | `settings-workspace.tsx:73` | |
| 5A.4 | "machine-derived candidates" | `transactions/capture-review-queue.tsx:194` | |
| 5A.5 | "machine-derived items into review before posting" (capture sheet) | mobile capture sheet copy (`components/navigation/*`) | |
| 5A.6 | "Native bridge contract: `window.moatNativeCapture.ingest(payload)`" + "host shell" ×2 | `capture-automation-panel.tsx:65-67,110-114` | |
| 5A.7 | "Postgres", "Sync bearer token", "Sync endpoint", "hosted sync backend requires authentication" | `sync-mode-panel.tsx:23,215-222` | |
| 5A.8 | Raw `entityType:entityId`, "Strategy: / Operation:", JSON dumps | `sync-conflicts-workspace.tsx:141-181` | |
| 5A.9 | "AES-GCM" (user-facing ×2) | `backup-panel.tsx:283`; `app/privacy/page.tsx:87` | |
| 5A.10 | "Envelopes" (budget jargon) ×3 | `dashboard-budget-coverage.tsx:26-28,33`; `budget-manager-panel.tsx:79` | |
| 5A.11 | "generic parser", raw confidence %, "parser refinement, not auto-learning", "Matched template:" | `capture-review-queue.tsx:80`; `correction-log-panel.tsx:35,45`; `text-capture-panel.tsx:242` | |
| 5A.12 | "Period balance bridge" (+ formula subtitle "Opening plus movement equals closing…") | `dashboard-balance-bridge.tsx:25` | |
| 5A.13 | "Posts to books as …" / "Posts as …" | `transaction-form.tsx:208`; `csv-import-sections.tsx:277` | |
| 5A.14 | "FX" ×4 ("Fallback FX to UGX", "FX rate to UGX", "Default FX rate to UGX", "FX rows") | `text-capture-panel.tsx:84`; `transaction-form.tsx:196`; `csv-import-sections.tsx:157,199` | |
| 5A.15 | Raw `reconciliationState` enum + "{n} records share {group.key}" internal key | `month-close-panel.tsx:108,118` | |
| 5A.16 | Compass third-person: "The user does not yet have at least three months…" | `investment-compass` guidance copy (`lib/domain/guidance.ts` strings) | |
| 5A.17 | "Parse SMS and notification text" ("parse") | capture sheet item copy | |
| 5A.18 | "Reconciled from opening balance and history." | accounts list subtitle (`accounts-workspace.tsx`) | |
| 5A.19 | "Movement" as user-facing column word (accounts rows, breakdown) | accounts list rows; `account-balance-breakdown.tsx` | |

### 5B. Wordy / redundant

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| 5B.1 | "Stored locally" restated ~10×: settings ×3, sync panel ×2, onboarding ×2, privacy ×3 | `settings-workspace.tsx:81,89,109-110`; `sync-mode-panel.tsx:165-169,280`; `profile-step.tsx:181-182`; `onboarding-workspace.tsx:174`; `app/privacy/page.tsx:257-259,300-303` + sections | |
| 5B.2 | Routes explaining developer architecture: "Statement imports live on their own route so mapping and review do not crowd the ledger" / "Rules and budget administration sit here instead of competing…" / "Manual entry and pasted text intake stay here so the main ledger stays clean" / "Posted movements first. Capture, import, and review each have their own route." | `transactions-import-workspace.tsx:18`; `transactions-tools-workspace.tsx:18`; `transactions-capture-workspace.tsx:75`; ledger frame `:41` | |
| 5B.3 | "5 minutes of inactivity" fact stated 3× (onboarding, PIN panel, success toast) | `security-step.tsx:69-72`; `pin-lock-panel.tsx:61,90-91` | |
| 5B.4 | Savings-rate popover: four dense sentences | `dashboard-sections.tsx:298-302` | |
| 5B.5 | Ledger title+description duplicated card-in-frame | `transaction-list.tsx:78-79` vs `transactions-ledger-workspace.tsx:41` | |
| 5B.6 | Filler subtitles that restate the title: "Update these settings to see how guidance changes." / "Targets are calculated from amount, deadline, and progress." / "Every row below contributes directly to the current balance above." / "Name it once and track it clearly." | `investment-compass-sections.tsx:118-119`; goals list; `account-ledger-workspace.tsx`; account form header | |
| 5B.7 | Google Drive stale-metadata paragraph could be one clause | `backup-panel.tsx:290-291` | |

### 5C. Terminology — one term per concept (decide once, apply everywhere)

| # | Concept | Current variants (locations in audit) | Decide | Status |
| --- | --- | --- | --- | --- |
| 5C.1 | Creating a transaction | Add / Record / Capture / Enter manually / Posts to books | "Add" (button), "add a transaction" (prose) | |
| 5C.2 | The transactions surface | Transactions / Ledger / Posted movements | "Transactions" (nav+title); "ledger" only inside account detail | |
| 5C.3 | Recurring items | Recurring obligations / recurring expectations / Missing obligations | "Recurring bills" (or "Expected bills") | |
| 5C.4 | Emergency reserve | Emergency cover / Emergency coverage / Suggested emergency moat / Emergency Fund | "Emergency fund" everywhere; ring label "x.x months cover" stays | |
| 5C.5 | Budgets | Budget coverage / Budget envelopes / envelopes | "Budgets" | |
| 5C.6 | Title capitalization | Title Case ("Investment Compass", "Learn Uganda") vs sentence case ("Sync conflicts", "Month close") | Sentence case app-wide | |
| 5C.7 | Save button verbs | Add transaction / Add account / Create goal / Save budget / Save rule / Save obligation / Set PIN | "Add X" for create, "Save" for edit | |
| 5C.8 | Local-first naming | Local only / Offline-first storage / Local pending version | "On this device" | |

### 5D. Tone

| # | Finding | Location | Status |
| --- | --- | --- | --- |
| 5D.1 | Alarmist: "Anyone with access to it can read them." | `security-step.tsx:75-79` — keep the fact, soften framing | |
| 5D.2 | "legacy corrupted data" shown to users ×2 | `account-balance-breakdown.tsx:92-95`; `repair-accounts-panel.tsx:72` | |
| 5D.3 | Preachy: "increase contributions to stay on track" / "planning floor, not a ceiling" / Learn kickers ("Use data, not promises") | `goal-list.tsx:127`; `goals-workspace.tsx:116-119`; `learn-workspace.tsx:117-118` | |
| 5D.4 | Terse dev errors: "Unable to load ledger." etc. ×3 | `account-ledger-workspace.tsx:131`; `learn-workspace.tsx:66`; `sync-conflicts-workspace.tsx:48` — add what-to-do-next | |
| 5D.5 | Sync mechanics exposed in success copy ("Local version queued again…", "Server version applied locally…") | `sync-conflicts-workspace.tsx:73,89` | |
| 5D.6 | Empty states name internals: "No capture items in this queue." / paste instructions | `capture-review-queue.tsx:212`; `text-capture-panel.tsx:137-139` | |
| 5D.7 | Firewall-style labels "Notification capture enabled/disabled", "Allowed/Blocked" | `capture-automation-panel.tsx:82` (also gated by 3.3) | |

### 5E. Legal placement

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 5E.1 | Uganda DPP Act 2019 cited in Settings section subtitle AND export-card description (twice on one screen) | `settings-workspace.tsx:97`; `data-export-panel.tsx:43-45` | Cite only on Privacy page; settings says "Your data, your rights →" link | |

Exit criteria: grep for each 5A string returns no user-facing hits; terminology table applied via one sweep per concept; re-read of every route’s copy at mobile width.

---

## Phase 6 — Widget & form-system consistency

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 6.1 | **Three date formats**: "21 Jul" (ledger) vs "05-07-2026" (account detail) vs "2027-06-30" (goals) | transaction list; `account-ledger-workspace.tsx`; `goal-list.tsx` | One `formatDate` helper ("21 Jul 2026" / "21 Jul" same-year); no raw ISO anywhere | |
| 6.2 | **Three date input widgets**: `DatePickerField` vs raw `type="date"` vs free-text | `account-form.tsx:193-200`; `onboarding/goal-step.tsx:69-76`; `text-capture-panel.tsx:187-194` | Standardize on `DatePickerField` | |
| 6.3 | PIN input hand-rolled 3× (`PinInputField` exists, used once) | `forms/pin-input-field.tsx` vs `pin-lock-panel.tsx:140-166`, `onboarding/security-step.tsx:36-67` | Use `PinInputField` everywhere | |
| 6.4 | `FormCardShell` bypassed — rules/obligations/budget/CSV/text-capture re-hand-roll Card+AccentCardHeader with drifting spacing; TextCapturePanel duplicates the embedded-vs-card branch | `transaction-rules-panel.tsx:82-88`; `recurring-obligations-panel.tsx:80-86`; `budget-manager-panel.tsx:76-82`; `csv-import-panel.tsx:52-58`; `text-capture-panel.tsx:267-281` | Route all through `FormCardShell` | |
| 6.5 | Goal "Target amount" is a bare div + raw Input with no `Label htmlFor` | `goal-form.tsx:111-120` | Use `InputField` | |
| 6.6 | Amount inputs: no thousand separators / UGX prefix while typing; currency hint inconsistent ("Amount (UGX)" vs bare "Expected amount") | all money inputs | One `AmountField` (formats as-you-type, UGX prefix) | |
| 6.7 | No `autoComplete` / `enterKeyHint` anywhere; no `autoFocus` on sheet open; focus not moved to first error | `account-form.tsx`, `goal-form.tsx`, `transaction-form.tsx`, all sheets | Add attributes; focus management on open + on invalid | |
| 6.8 | Enter never submits hand-rolled panels (buttons outside `<form>`) | `transaction-rules-panel.tsx:213-240`; `recurring-obligations-panel.tsx:177-199`; `budget-manager-panel.tsx:226-235` | Wrap in `<form onSubmit>` | |
| 6.9 | Long selects unsearchable (category/account; budget "Source income" lists every income tx; CSV mapping = 9 selects × all headers) | `budget-manager-panel.tsx:62-70`; `csv-import-sections.tsx:58-70` | Combobox for long lists | |
| 6.10 | `transactionTypeLabels` duplicated (canonical in `lib/select-options` vs local copy) | `account-ledger-workspace.tsx:48-54` | Import canonical | |
| 6.11 | Reinvented toggle: "Allowed/Blocked" text button instead of `Switch` | `capture-automation-panel.tsx:16-42` | Use `Switch` (if panel survives 3.3) | |
| 6.12 | Dead props: `min`/`max` on text-rendered priority input | `goal-form.tsx:159-162` | Real number input or remove | |
| 6.13 | Account ledger (detail page) is read-only with no edit affordance — editing only via main ledger | `components/accounts/account-ledger-workspace.tsx` | Row tap → same edit sheet as main ledger | |

Exit criteria: one date formatter, one date picker, one amount field, one PIN field; Enter submits every form; no duplicated label maps.

---

## Phase 7 — Kept-but-verify (positives to protect while executing)

These were verified good; do not regress them during the phases above.

- No lorem/TODO/"coming soon" anywhere in UI.
- Investment Compass guidance is rule-based, no hardcoded rates/years — ages well (`lib/domain/guidance.ts`).
- Learn links: real official Ugandan sources (BoU, CMA, USE, URBRA, UMRA, UBOS, FSD). Refresh dated titles periodically ("FinScope 2023").
- Local encrypted backup + restore, JSON export: work end-to-end.
- Google Drive backup correctly framed as backup-not-sync; genuinely wired (OAuth, appData).
- Delete-account type-to-confirm flow — the pattern to copy in 1.1.
- Account detail running-balance ledger design.
- Sync outbox/engine plumbing (tested) — keep behind the 3.1 flag.

---

## Execution order & status board

| Phase | Theme | Items | Status |
| --- | --- | --- | --- |
| 0 | Trust-breaking bugs | 6 | ⬜ (0.1 fixed, uncommitted) |
| 1 | Destructive safety & feedback | 7 | ⬜ |
| 2 | Validation | 6 | ⬜ |
| 3 | De-scope undeliverable surfaces | 6 | ⬜ |
| 4 | Screen usability | 16 | ⬜ |
| 5 | Copy (5A×19, 5B×7, 5C×8, 5D×7, 5E×1) | 42 | ⬜ |
| 6 | Widget/form consistency | 13 | ⬜ |
| 7 | Protect the good parts | — | continuous |

**Total tracked items: 96.** Every item ends ✅ (with commit) or ❌ (with reason). No silent drops.
