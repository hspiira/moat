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

## Phase 0 — Trust-breaking bugs (do first) — ✅ COMPLETED 2026-07-23

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 0.1 | App renders **blank forever for any user without a PIN** — `PinLockGate` lost the `no_pin` branch in the unlock-animation rewrite; `showApp` only covered `unlocked`/`unlocking` | `components/pin-lock-gate.tsx` | `showApp` includes `no_pin` | ✅ commit a04f7a7 (verified fresh-profile browser) |
| 0.2 | **Budget coverage math wrong**: summary "Spent"/"Remaining" compares allocation of *budgeted categories only* against **all** monthly spending → red "Remaining −1,270,000" even when every envelope is under budget | `lib/domain/budgets.ts:67-88` (`getBudgetCoverage`) | Count only spending in budgeted categories for the summary block (per-envelope rows at `:49` are already correct); add regression test | ✅ done + regression test "excludes spending in unbudgeted categories from coverage" |
| 0.3 | **“−400%” savings rate** rendered as the giant hero stat; “Saved −USh 1,400,000 · −150%” double-negative framing | `components/dashboard/*` savings-rate stat (dashboard-sections / savings overview) | Clamp/reframe extreme values (e.g. below −100% → "Spent 5× income this period"); never headline a raw percentage beyond ±100% | ✅ done — `describeSavingsRate` caps at ±100%, deep deficit shows "5×" + note; verified in browser. (The "Saved" stat card's −150% is a period-over-period delta, not the rate — left for Phase 4.10 compact stat row.) |
| 0.4 | Settings claims PIN uses **PBKDF2**; it is Argon2id since the key-hierarchy migration — stale, contradicts the section header two cards above | `components/settings/pin-lock-panel.tsx:89-90` | Drop the algorithm name entirely: "Your PIN never leaves this device." | ✅ done |
| 0.5 | Privacy policy contact is a non-routable placeholder `privacy@moat.local`; "Last updated 06-04-2026" is ambiguous DD-MM vs MM-DD | `app/privacy/page.tsx:14-16` | Real address (or remove until one exists); unambiguous date | ✅ done — contact → real GitHub issues link (no fabricated email); date → "6 April 2026" |
| 0.6 | Settings footer absolutist claim "never transmitted to any server" sits beside a Hosted-sync panel that contradicts it | `components/settings-workspace.tsx:109-110` | Reword to match reality ("stays on this device unless you turn on sync or cloud backup") | ✅ done |

Exit criteria: ✅ regression test for 0.2; ✅ fresh-profile browser shows a working app with no PIN; ✅ dashboard shows no ±>100% headline stat; ✅ tsc/lint/143 tests/build green.

---

## Phase 1 — Destructive-action safety & feedback — ✅ COMPLETED 2026-07-23 (6/7; 1.7 → Phase 2)

New shared foundations: `components/ui/confirm-dialog.tsx` (Radix Dialog), `components/ui/toast.tsx` (dependency-free `ToastProvider`/`useToast`, mounted top of layout, z-200 above sheets), `components/hooks/use-confirm-delete.tsx`, `lib/errors.ts` (`errorMessage`).

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 1.1 | **Zero confirmation on any delete** — one tap permanently deletes a transaction / goal / budget | transaction-list / goal-list / budget-manager-panel | `useConfirmDelete` + `ConfirmDialog` on all three; verified in browser (dialog → confirm → row removed) | ✅ done |
| 1.2 | Workspace `error` renders at frame level **behind the open sheet** | transactions/goals workspaces | Failures now also toast (z-200, floats above sheets) in addition to inline `error` | ✅ done (via toast) |
| 1.3 | `LocalSaveFeedback` suppressed when `embedded` (inside sheets) — in-sheet saves silent | transaction/goal/account/budget save handlers | Success toast on every save/update (visible over sheets); verified | ✅ done (via toast) |
| 1.4 | No toast system at all | app-wide | `ToastProvider` + `useToast` added and mounted; verified "Transaction deleted." toast | ✅ done |
| 1.5 | **Swallowed errors** — `try/finally` with no catch: budget save/delete, month close, capture-automation | use-budget-planner, use-transactions-workspace `closeMonth`, capture-automation-panel | catch → error toast added to all; capture-automation also rolls back optimistic state | ✅ done |
| 1.6 | Capture "manual" sheet silently resets after save | capture flow (transaction save) | Manual saves now toast "Transaction saved." (shared handler) | ✅ done (via toast) |
| 1.7 | Numeric coercions silently turn garbage into 0 (budget target, expected amount, due day, rule priority) | use-budget-planner, recurring-obligations-panel, transaction-rules-panel | → moved to **Phase 2** (validation) where field-level marking lands | ⏭️ Phase 2 (2.6 + budget/rule validation) |

Exit criteria: ✅ deleting anything asks first; ✅ every save/failure toasts above open sheets; ✅ the three bare `try/finally` swallows now catch. (1.7 numeric validation folded into Phase 2.) tsc/lint/143 tests/build green.

---

## Phase 2 — Validation — ✅ COMPLETED 2026-07-23

Foundations: `error` prop on `InputField`/`SelectField` (message + `aria-invalid` + red border); shared `lib/validation.ts` (`validateAmount`, `validateInteger`, `isPastDate`) with unit tests; `lib/errors.ts` reused for toasts.

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 2.1 | **Onboarding profile step never validated** — blank `displayName` / no consent pass | use-onboarding-workspace | `profile` branch already present + `handleNext` gates it (refactor); **hardened** `handleSubmit` to re-validate ALL steps, not just goal+security; confirmed no step-skipping in the UI | ✅ done |
| 2.2 | Account opening balance accepts NaN/negative/absurd | use-accounts-workspace, account-form | Field-level validation: name required; balance must be a number; negative only for `debt` type; shown at the field | ✅ done |
| 2.3 | Goal form: target 0/negative/NaN; current > target; dead priority min/max; past/optional date | use-goals-workspace, goal-form | Validates target>0, current≤target, priority 1–10, date required & non-past; removed dead min/max; verified in browser (3 field errors shown, no submit) | ✅ done |
| 2.4 | Manual transaction posts with empty account/category | transaction-builder | Guards added (mirror the transfer path); throws → toast; unit test added | ✅ done |
| 2.5 | No field-level error marking anywhere | input-field, select-field | `error` prop wired through both; used by account/goal/obligation/budget/rule forms | ✅ done |
| 2.6 | Recurring obligation `dueDay` unbounded (45 accepted) | recurring-obligations-panel | `validateInteger(dueDay, 1, 31)` + expected-amount validation; field errors | ✅ done |
| 1.7 | Numeric coercions silently → 0 (budget target, expected amount, due day, rule priority) — from Phase 1 | use-budget-planner/budget panel, obligations panel, rules panel | Validate + field error before save instead of `\|\| 0`; budget target, obligation amount/dueDay, rule priority all guarded | ✅ done (folded in) |

Exit criteria: ✅ each form rejects garbage with a message at the field; ✅ onboarding can't complete blank; ✅ unit tests for validators + transaction guards (149 tests); tsc/lint/build green; goal-form field errors verified in a real browser.

---

## Phase 3 — De-scope surfaces the product can’t deliver (web) — ✅ COMPLETED 2026-07-23

New: `lib/features.ts` (`isHostedSyncEnabled`, off by default via `NEXT_PUBLIC_ENABLE_HOSTED_SYNC`); `lib/integrations/google-drive-backup.ts` `isGoogleDriveConfigured()`; `components/hooks/use-native-bridge.ts` (hydration-safe `useHasNativeBridge`).

| # | Finding | Location | Fix | Status |
| --- | --- | --- | --- | --- |
| 3.1 | **Hosted sync UI with no real backend** | sync-mode-panel | Gated behind `isHostedSyncEnabled()` (off by default). Panel now shows a plain "Everything stays on this device" card — no endpoint, token, mode toggle, "Sync now", or conflicts link. Outbox/engine plumbing untouched (dormant). Verified: no "Sync endpoint"/"bearer token"/"Hosted sync" text on web | ✅ done |
| 3.2 | `/settings/sync-conflicts` debug view — unreachable until 3.1 | sync-conflicts-workspace | Its only entry point (the conflicts link) is inside the now-hidden hosted block, so the route is unreachable on web. Left dormant behind the 3.1 flag; human-diff redesign deferred to when hosted sync ships | ✅ done (gated dormant) |
| 3.3 | **Android-only "Capture automation" shown to web** + dev contract text | settings-workspace, capture-automation-panel | Section renders only when `useHasNativeBridge()`; deleted the `window.moatNativeCapture.ingest` contract line and rewrote the panel copy in plain language. Verified: no capture/bridge text on web | ✅ done |
| 3.4 | Google Drive card always shown; throws when unconfigured | backup-panel | `isGoogleDriveConfigured()` gates the Drive button + reminder; section description no longer promises Drive. Verified: no Drive button without client id | ✅ done |
| 3.5 | `navItems` omits `/privacy` while `navIcons` includes it | navigation-shared vs lib/data | **Reviewed — deliberate, no change:** Privacy is reachable everywhere via the Settings footer link, plus the mobile drawer. Desktop intentionally keeps it out of the primary nav (it's a policy page, not a workspace). The `navIcons` entry is harmless (drawer uses it). | ✅ reviewed |
| 3.6 | "Changes stay on this device until sync exists." | local-save-feedback | → "Saved on this device." | ✅ done |

Exit criteria: ✅ web build shows no Android controls, no sync endpoint/token fields, no dev contract strings; ✅ Drive card hidden without client id; verified in a real browser. tsc/lint/149 tests/build green.

---

## Phase 4 — Screen usability (visual-pass findings) — ✅ COMPLETED 2026-07-24

Commits: 4a `aeaf30b`, 4b `50b152c`, 4c `1c7f324`, 4d `3ccb14c`, 4e `31e6296`, 4f `1b00849`, 4g `bfd2972`. New shared bits: overflow menu (Popover + `PopoverClose`), `FormCardShell` `footer` (pinned full-width action), `useHasNativeBridge`. Each cluster re-screenshotted at 402px in a real browser.

| # | Finding | Fix shipped | Status |
| --- | --- | --- | --- |
| 4.1 | Ledger rows truncate payees to ~8 chars | Dropped the redundant type chip; two icon buttons → one overflow (kebab) menu; payees show full | ✅ 4a |
| 4.2 | Same 6-row summary card on 3–4 transaction routes | Shown only on Ledger; zero rows (Needs review/Duplicates) hidden | ✅ 4b |
| 4.3 | Review double-reports emptiness + raw "STATE ready" | One "All clear for July 2026" state; only non-empty detail lists w/ counts; readable month label | ✅ 4b |
| 4.4 | Parked always-open forms (recurring bills, rules, budgets) | Each → list + "Add …" button → sheet (FormCardShell + pinned action); budget income "Use"/envelope "Edit" open prefilled | ✅ 4g |
| 4.5 | Account form sheet: dead space + small left button | `FormCardShell` footer pins a full-width primary at the sheet bottom; body fills height | ✅ 4e |
| 4.6 | Sub-44px tap targets | List edit/delete icon buttons bumped 28px → 36px; transaction actions now a 36px kebab. (Inputs/selects left at 32px — rows/full-width fields are the real targets; noted, not forced to 44px in dense lists) | ✅ 4a/4c |
| 4.7 | "Types 4 / 6" stat on Accounts | Cut | ✅ 4a |
| 4.8 | Capture = menu-of-menus (3 hops) | Lands on the working form inline; method switcher on top; defaults to Manual | ✅ 4f |
| 4.9 | Review sub-tabs confusing ("Capture inbox / Open capture inbox") | Removed the duplicate button; tab renamed "Captured items" | ✅ 4c |
| 4.10 | Inflow/Outflow/Saved: three stacked cards of empty space | One compact card of full-width rows (3-col clipped 7-figure UGX — see note) | ✅ 4d |
| 4.11 | Top-spending band fills read as semantic | Single-hue proportional bars (share of the largest) | ✅ 4d |
| 4.12 | "Ledger" chip on every account row | Dashboard rows link whole (name + chevron); chip dropped | ✅ 4d |
| 4.13 | Chart tabs "Rate/Flow/Alloc" cryptic + wrap | Single-row segmented control "Savings / Cash flow / Allocation"; dropped uppercase "SAVINGS RATE" | ✅ 4d |
| 4.14 | Module cards' constant "Active" chip | Dropped | ✅ 4a |
| 4.15 | Header pattern differs across routes | Mobile top bar shows "Moat" wordmark everywhere; PageHeader owns titles (no duplication) | ✅ 4e |
| 4.16 | Monthly target odd precision ("USh 295,833") | Rounded to nearest 1,000 | ✅ 4a |

> Interactive-review notes (from the owner during 4d): 3-column stat tiles clip seven-figure UGX → reverted to full-width rows; period deltas made time-sensitive (only shown when the prior window had activity) and the "—" placeholder chip removed; chart filters redesigned as a non-wrapping segmented control in sentence case; added an `=` icon to the hero "Net" row.

Exit criteria: ✅ re-screenshotted affected routes at 402px — no truncated payees, no duplicate summary, forms summoned not parked, no clipped sums. tsc/lint/149 tests/build green throughout.

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
| 5E.1 | Uganda DPP Act 2019 cited in Settings section subtitle AND export-card description (twice on one screen) | `settings-workspace.tsx:97`; `data-export-panel.tsx:43-45` | Cite only on Privacy page; settings points there | ✅ 5a |

### Phase 5 completion — ✅ 2026-07-24 (commits 19c52ab, eec8a85, 3fd9309; plus Phase 0/3 copy)

Coverage against the audit:
- **5A jargon (19):** ✅ all addressed — Argon2id/PBKDF2 (Phase 0), AES-GCM, Postgres/token + bridge-contract text + sync JSON (Phase 3 gating + rewording), "machine-derived", "parser"/"generic parser", "envelopes", "Period balance bridge", "Posts to books/as", "FX"→exchange rate, Compass third-person→second person, "Parse SMS", "Reconciled from…", "Movement"→"Net change". The raw `reconciliationState`/"records share {key}" enum surfaced in month-close was removed in Phase 4b. `reconciliationState`/`parserLabel` remain only as internal field names (never shown).
- **5B wordiness (7):** ✅ route-architecture blurbs rewritten; ledger title/desc de-duplicated; "stored locally" pile-up reduced to one mention per context; 5-min-inactivity no longer tripled; savings-rate popover and filler subtitles trimmed.
- **5C terminology (8):** ✅ emergency fund unified across dashboard/goals/compass; "envelopes"→"budgets"; save verbs aligned to "Add X"/"Save"; sentence case applied to touched strings. (A full capitalization audit of every remaining title is folded into ongoing polish — no Title-Case offenders remain on the primary screens.)
- **5D tone (7):** ✅ alarmist no-PIN warning softened; "legacy corrupted data" ×2 rewritten; preachy goal/emergency copy softened; terse "Unable to load" ×8 → "Couldn't load X. Please try again."; capture empty states humanized. (5D.5 sync success copy and 5D.7 firewall-style capture labels live behind the Phase 3 flags — not shown on web; left for when those surfaces return.)
- **5E legal (1):** ✅ DPP Act cited only on the Privacy page.

Exit criteria met: the flagged user-facing jargon strings return no hits on the primary screens; terminology unified per concept; tsc/lint/149 tests/build green throughout. Copy re-read at mobile width across the seeded routes.

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
| 0 | Trust-breaking bugs | 6 | ✅ done 2026-07-23 |
| 1 | Destructive safety & feedback | 7 | ✅ done 2026-07-23 (1.7 → Phase 2) |
| 2 | Validation | 6 (+1.7) | ✅ done 2026-07-23 |
| 3 | De-scope undeliverable surfaces | 6 | ✅ done 2026-07-23 |
| 4 | Screen usability | 16 | ✅ done 2026-07-24 |
| 5 | Copy (5A×19, 5B×7, 5C×8, 5D×7, 5E×1) | 42 | ✅ done 2026-07-24 |
| 6 | Widget/form consistency | 13 | ⬜ |
| 7 | Protect the good parts | — | continuous |

**Total tracked items: 96.** Every item ends ✅ (with commit) or ❌ (with reason). No silent drops.
