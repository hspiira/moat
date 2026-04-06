# Moat — Project Tracker

| Field        | Value                                |
| ------------ | ------------------------------------ |
| Status       | Active development                   |
| Owner        | Piira                                |
| Last updated | 2026-04-06                           |
| Stack        | Next.js 16, TypeScript, shadcn/ui, IndexedDB |

---

## What This Document Is

A living tracker for project state, decisions, open questions, ideation backlog, and automation research. It is the single place to record anything that does not belong in the PRD, architecture doc, or code — including hypotheses, rejected ideas, and future research threads.

---

## Current State (April 2026)

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
- Local-first persistence via IndexedDB — no backend, no auth in v1

### What is not yet built

- Authentication / multi-device sync
- PDF statement parsing (MTN, Stanbic, DFCU)
- Native Android host shell / Capacitor bridge for mobile capture
- Android notification listener ingestion
- Correction logging and parser refinement workflow
- Provider-grade parser packs with broad MTN, Airtel, and bank fixture coverage
- Push notifications / reminders
- Institution verification workflows

---

## Pilot Readiness

Reference: `docs/pilot-readiness-checklist.md`

### Gate status (self-assessed, April 2026)

| Gate | Status | Notes |
|------|--------|-------|
| `npm run typecheck` passes | ✅ | Confirmed |
| `npm run lint` passes | Unverified | Run before pilot |
| `npm run test` passes | Unverified | Run before pilot |
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
| Data backup / restore | JSON export/import, server sync, none | Unresolved |
| Auth model | Local-only forever, optional account, required account | Unresolved |
| Goal–account linking in UI | Required, optional, not shown | Optional (implemented) |
| Reminders | In-app only, push/email, none in v1 | None in v1 |
| CSV parser scope | Current column-mapping approach | Decided — keep |
| PDF statement parsing | Build parser per institution | Future — post-pilot |

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

**Phase 2 (current implementation plan):** simple capture platform. Start with share-to-app, capture inbox, Android notification listener, parser packs, confidence, deduplication, and correction logging. Reference: `docs/phase-2-simple-capture-implementation-plan.md`.

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
| `#27` | Share-to-app and paste-to-app intake | Partial — paste flow and web share-target exist; native Android share intent still missing |
| `#34` | Deterministic parse pipeline, confidence, dedupe, source metadata | Partial — source metadata, hashes, duplicate hints, and basic confidence exist; no canonical pipeline modules or field-level confidence model yet |
| `#30` | MTN, Airtel, and bank parser templates | Partial — first generic templates exist; not yet provider-grade or fixture-complete |
| `#55` | Android host shell and native bridge | Not started |
| `#25` | Android notification listener ingestion | Not started |
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
