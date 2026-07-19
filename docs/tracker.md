# Moat — Project Tracker

| Field        | Value                                |
| ------------ | ------------------------------------ |
| Status       | Active development                   |
| Owner        | Piira                                |
| Last updated | 2026-07-19                           |
| Stack        | Next.js 16, TypeScript, shadcn/ui, IndexedDB / SQLite (native) |

---

## What This Document Is

A living tracker for project state, decisions, open questions, ideation backlog, and automation research. It is the single place to record anything that does not belong in the PRD, architecture doc, or code — including hypotheses, rejected ideas, and future research threads.

---

## Consolidation Update (2026-07-19)

A consolidation pass reconciled the docs with the code and closed several review findings:

- **Naming**: the product is **Moat** everywhere. `package.json` renamed, "Uganda Finance App" retired from all docs, stray root files and the vestigial `capacitor.config.json` removed (the native shell is a hand-rolled WebView host, not Capacitor).
- **Docs restructure**: docs now live under `docs/{product,architecture,plans,research,testing}` with an index at `docs/README.md`. The stale pre-build architecture doc was removed and replaced by `docs/architecture/overview.md`, which describes the system as implemented.
- **CI added**: `.github/workflows/ci.yml` runs typecheck, lint, test, and build on every push/PR. All four verified green on 2026-07-19 (101 tests).
- **Encryption posture decided and implemented**: PIN + at-rest encryption is the onboarding default. Minimum PIN is 6 digits with escalating unlock throttling (30s after 5 failures, doubling, 15-minute cap). Onboarding sets the PIN before the first record is written. Restores still accept legacy 4-digit backup PINs.
- **Goal progress is now derived**: goal progress = manual starting amount + savings contributions on the linked account (`deriveGoalCurrentAmount`), resolving the contradiction between the pilot checklist and the old stored-only `currentAmount`. `MonthSummary.net` now means inflow − outflow − allocated savings (previously a duplicate of `savings`).
- **Service worker fixed**: precache now covers the icons the manifest actually uses, installs resiliently, and caches visited pages so previously opened routes work offline.
- **Transactions workspace refactored**: balance reconciliation moved off the read path (loads no longer write to storage; only changed balances persist after mutations). Transaction construction and the month-close CSV are pure, tested modules; budgets and rules/obligations live in their own hooks.
- **Sync backend loudly marked dev-only**: routes refuse to run the hosted file-backed store without a bearer token, and code/docs state that per-user auth and a real database are prerequisites for real hosted sync.

---

## Current State (July 2026)

### What is built and working

- Onboarding flow at `/onboarding` — creates profile, seeds categories and resources, redirects to dashboard
- Account management at `/accounts` — full CRUD via IndexedDB repository, balance reconciliation
- Transaction recording at `/transactions` — manual entry for all types, transfer pair logic, CSV import with column mapping and duplicate detection
- Accounting depth baseline — running ledgers, period opening/movement/closing balances, reconciliation states, rule engine, recurring obligations, month close, and property-based accounting tests
- Phase 2 capture inbox baseline — pasted/shared/file-derived captures persist as envelopes and review items before posting
- Capture review route at `/transactions/review/capture` — supports `New`, `Needs review`, `Duplicates`, and `Resolved` style review-first capture handling
- In-app text, image, and document extraction capture — reviewed candidates can be sent into the capture inbox instead of directly creating transactions
- Parser and dedupe foundation — message hash linkage, duplicate hints, source metadata, and first MTN/Airtel/bank-style template matching
- Goals at `/goals` — target-based goals, monthly contribution math, progress from savings transactions, emergency fund priority
- Investment Compass at `/investment-compass` — rule-based guidance engine, horizon + liquidity + emergency coverage + debt signals
- Learn Uganda at `/learn` — official and research resources grouped by topic
- Dashboard at `/` — monthly summary, top categories, account balances, monthly prompts
- Light / dark theme toggle in navigation
- All forms use shadcn/ui components — no native input/select/textarea in any user-facing component
- Local-first persistence via IndexedDB (web) and SQLite (native bridge) behind one repository interface
- PIN lock with at-rest record encryption — onboarding default, min 6 digits, throttled unlock
- Encrypted backup and restore — local `.enc` file and Google Drive (appdata scope)
- PWA install, offline shell, and share-target intake; hand-rolled Android WebView host shell with share-to-app capture implemented in code (not device-verified)
- Client-side sync engine, outbox, and per-entity conflict rules with a manual-review queue at `/settings/sync-conflicts` (server side is a dev-only stub)
- CI: typecheck, lint, test, build on every push/PR

### What is not yet built

- Hosted multi-device sync backend (per-user auth + real database; current server is a dev-only file stub)
- PDF statement parsing (MTN, Stanbic, DFCU)
- Android notification listener rollout — service code exists but there is no permission-grant UX and it is not device-verified
- Correction logging and parser refinement workflow
- Provider-grade parser packs with broad MTN, Airtel, and bank fixture coverage
- Push notifications / reminders
- Institution verification workflows
- Component/E2E test coverage of the interactive UI layer

---

## Pilot Readiness

Reference: `docs/testing/pilot-readiness.md`

### Gate status (verified 2026-07-19)

| Gate | Status | Notes |
|------|--------|-------|
| `pnpm typecheck` passes | ✅ | Verified 2026-07-19; enforced in CI |
| `pnpm lint` passes | ✅ | Verified 2026-07-19; enforced in CI |
| `pnpm test` passes | ✅ | 101 tests, verified 2026-07-19; enforced in CI |
| `pnpm build` passes | ✅ | Verified 2026-07-19; enforced in CI |
| `/accounts` works end-to-end | ✅ | Full CRUD, balance reconciliation |
| `/transactions` works end-to-end | ✅ | Manual + CSV import |
| `/goals` works end-to-end | ✅ | Contribution plans, delete |
| `/investment-compass` works | ✅ | Rule engine, profile save |
| `/learn` works | ✅ | Resources grouped by topic |
| `/onboarding` exists and flows to dashboard | ✅ | New in this update |
| Source links spot-checked | ❌ | Required before pilot |
| Guidance copy reviewed for compliance | ❌ | Required before pilot |
| Mobile screen sizes verified | ❌ | Required before pilot |
| UGX labels consistent across all routes | Partial | Verify |
| No developer copy visible to users | ✅ | Cleaned in this update |

---

## Open Decisions

| Decision | Options | Status |
|----------|---------|--------|
| Data backup / restore | JSON export/import, server sync, none | **Resolved** — encrypted `.enc` backup/restore to file and Google Drive (plaintext JSON export also exists) |
| Encryption posture | Opt-in PIN, default PIN, mandatory PIN | **Resolved (2026-07-19)** — PIN + encryption is the onboarding default, ≥6 digits, throttled unlock; explicit opt-out with warning |
| Auth model | Local-only forever, optional account, required account | Unresolved — blocks hosted sync; current sync server is dev-only |
| Goal–account linking in UI | Required, optional, not shown | Optional (implemented) |
| Reminders | In-app only, push/email, none in v1 | None in v1 |
| CSV parser scope | Current column-mapping approach | Decided — keep |
| PDF statement parsing | Build parser per institution | Future — post-pilot |

### Open strategy questions

Four product/business questions are unanswered and need founder decisions rather than engineering: monetization, distribution/go-to-market, analytics instrumentation, and PDPO registration ownership (plus Learn-content governance). These do not block the local-first pilot but block scaling beyond it. See [product/open-questions.md](product/open-questions.md).

---

## Mobile Money API Research

### What the APIs offer

**MTN Mobile Money Open API** (`momodeveloper.mtn.com`)
- Uganda is a supported market
- Available: Collections (receive payments), Disbursements (send payments), Remittances, balance inquiry
- **Not available**: Transaction history retrieval. There is no `/statements` or `/history` endpoint for user wallets
- Use case for Moat: balance snapshots, payment webhooks for goal top-ups
- Access: apply via developer portal; sandbox is free; production requires business approval

**Airtel Money API**
- Similar model to MTN — payments in/out, not statement retrieval
- Uganda coverage exists; developer portal access is more restricted

### What actually works for automation

| Method | What it gives you | Works on web? | Effort |
|--------|-------------------|---------------|--------|
| MTN/Airtel API — Collections | Payment confirmation webhooks | Yes | Medium |
| MTN/Airtel API — Balance | Current wallet balance | Yes | Low |
| SMS parsing | Full transaction history from confirmation messages | No — Android native only | High |
| PDF statement upload | Full history from exported statements | Yes | Medium |
| CSV import | Full history from exported statements | Yes | Done |

### Recommended automation roadmap

**Phase 1 (now):** CSV import — already built. Covers MTN mini-statements, Stanbic, DFCU, Centenary exports.

**Phase 2 (current implementation plan):** simple capture platform. Start with share-to-app, capture inbox, Android notification listener, parser packs, confidence, deduplication, and correction logging. Reference: `docs/plans/phase-2-capture.md`.

**Phase 3 (later / native expansion):** deeper native Android capture beyond notification listener, including any policy-approved SMS-adjacent capabilities if distribution constraints and platform rules make them viable.

**Phase 4 (partnership/later):** MTN MoMo Open API integration for balance display and goal funding via payment requests.

### Why not bank screen scraping
Legally problematic, fragile, breaks on every UI update, and likely violates bank terms of service. Do not pursue.

---

## Ideation Backlog

Items here are not prioritised. They move to GitHub issues when they are ready to build.

### High potential

- **PDF statement parser**: MTN Uganda and major bank statements are parseable. Would dramatically reduce manual entry friction. Android + iOS compatible.
- **Deep Android message capture**: After Phase 2 share intake and notification capture, evaluate whether stricter Android-native channels are worth the distribution and policy cost.
- **Balance sync via MTN MoMo API**: Show live wallet balance without statement import. Low complexity, high trust signal.
- **Smart categorisation from notes**: Use transaction notes to suggest categories (e.g. "boda" → Transport). Simple keyword matching to start.
- **Recurring transaction detection**: Detect regular patterns (monthly rent, airtime) and prompt the user to confirm rather than re-enter.
- **Budget targets with progress bars**: Monthly spend limits per category with visual progress. Natural next step after spending visibility.

### Medium priority

- **Debt payoff planner**: User records a debt (e.g. SACCO loan), sets monthly repayment, sees payoff date and interest cost estimate.
- **Household / shared planning**: Multiple profiles under one account. Important for families or couples managing money together.
- **Multi-currency support**: For Ugandans who travel or receive remittances in USD/KES. Low priority for MVP pilot.
- **Onboarding tour / empty state guidance**: First-time user walkthroughs for each route. Currently empty states use plain text — could be richer.
- **Goal funding reminders**: Monthly push/SMS reminder when a savings goal contribution is due.

### Long-term / infrastructure

- **Backend sync**: Move from local-only IndexedDB to server-backed Postgres + authenticated API. Prerequisite for multi-device and household features.
- **Open banking (Uganda)**: Bank of Uganda has discussed open banking frameworks. Not actionable now, watch for regulatory progress.
- **Small business mode**: Separate personal vs business cash flows for founders who currently mix them. Very common in Uganda.
- **SACCO integration**: If licensed SACCOs expose APIs or CSV exports, this is a high-value integration.
- **Investment product deeplinks**: Partner with licensed fund managers (UAP, NSSF) to link out to onboarding for regulated products users discover via the Compass.

### Won't do / rejected ideas

- **Direct trade execution**: Out of scope. Moat is guidance, not a brokerage.
- **AI financial advice**: Personalised LLM advice creates regulatory exposure. Rule-based engine is safer and more explainable.
- **Bank screen scraping**: Legally gray, fragile, probably violates terms of service.
- **Crypto tracking**: Not aligned with Uganda-first investment reality for the target user.
- **Tax filing**: Different product category. Complex regulatory surface.

---

## Architecture Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Local-first IndexedDB for v1 | Fast to ship, no auth complexity, suitable for pilot cohort of <20 users |
| 2026-04-05 | No mobile money sync in v1 | MTN/Airtel APIs don't provide statement history; SMS parsing requires native app |
| 2026-04-05 | CSV import as v1 automation | Most reliable cross-platform approach until native app is built |
| 2026-04-05 | Rule-based investment guidance, not LLM | Explainability, compliance safety, deterministic behaviour |
| 2026-04-05 | shadcn/ui for all components | Consistent design system, full dark/light theme support, accessible |
| 2026-04-05 | Next.js App Router | Familiar stack, server component readiness for post-IndexedDB phase |
| 2026-07-19 | PIN + encryption as onboarding default (≥6 digits, throttled unlock) | Financial data on shared/lost devices; opt-in encryption left most users unprotected |
| 2026-07-19 | Balance reconciliation off the read path | Loads were writing reconciled balances back on every view, churning storage and the sync outbox |
| 2026-07-19 | Goal progress derived from linked-account savings contributions | Stored-only `currentAmount` went stale and contradicted the pilot checklist |
| 2026-07-19 | Sync server stays dev-only until per-user auth + real database exist | Shared-token file store has no tenancy; routes now fail closed without a token |
| 2026-07-19 | Docs restructured under `docs/{product,architecture,plans,research,testing}` | Two doc generations had drifted; tracker is now the single status source |

---

## Upcoming Work (Next Issues)

Suggested priority order after current state:

1. **Android host shell and native bridge** — tracked in `#55`
2. **Share-to-app intake completion on native Android** — tracked in `#27`
3. **Android notification capture** — tracked in `#25`
4. **Deterministic parse pipeline hardening** — tracked in `#34`
5. **MTN, Airtel, and bank parser packs expansion** — tracked in `#30`
6. **Correction logging for parser refinement** — tracked in `#54`

### Phase 2 status snapshot

| Issue | Scope | Status |
|------|--------|--------|
| `#56` | Phase 2 epic | In progress — foundation work exists, native/mobile channels still missing |
| `#53` | Capture inbox and review queue | Implemented in code; ready for review/board update |
| `#27` | Share-to-app and paste-to-app intake | Implemented in code — Android share intent, host-shell handoff, and capture-review inbox routing are wired; validate on device |
| `#34` | Deterministic parse pipeline, confidence, dedupe, source metadata | Partial — canonical pipeline modules, source adapters, provider packs, hashes, duplicate hints, and field warnings exist; provider coverage and refinement loop still incomplete |
| `#30` | MTN, Airtel, and bank parser templates | Partial — first generic templates exist; not yet provider-grade or fixture-complete |
| `#55` | Android host shell and native bridge | Implemented in code — WebView host, payload queue, JS bridge, and review-route handoff are present; needs device verification and notification-specific follow-up |
| `#25` | Android notification listener ingestion | Implemented in code (manifest service, allowlist gating, settings sync) but **not rolled out** — no permission-grant UX, no device verification, Play policy review pending |
| `#54` | Correction logging and parser refinement workflow | Not started |

---

## Team / Contributors

| Person | Role |
|--------|------|
| Piira | Product owner, lead developer |

---

## Key Reference Links

- [MTN MoMo Developer Portal](https://momodeveloper.mtn.com)
- [FinScope Uganda 2023 Summary](https://fsduganda.or.ug/wp-content/uploads/2024/04/FinScope-Uganda-2023-Findings-Summary.pdf)
- [Bank of Uganda Bills and Bonds](https://bou.or.ug/bouwebsite/FinancialMarkets/billsandbonds.html)
- [Capital Markets Authority Uganda](https://cmauganda.co.ug/)
- [Uganda Securities Exchange](https://use.or.ug/)
- [Uganda Microfinance Regulatory Authority](https://umra.go.ug/)
- [Uganda Retirement Benefits Regulatory Authority](https://www.urbra.go.ug/)
