# Moat — Technical and Commercial Assessment

**Date:** 2026-07-29
**Prepared for:** Founder / engineering review
**Basis:** Direct measurement of the repository at commit `620aa93` (branch `refactor/code-quality-remediation`). Every figure below is reproducible from the codebase; no estimates are used.

---

## Executive summary

Moat is a local-first personal finance application for the Ugandan market, built to an unusually high engineering standard. Across 27,189 lines of source it carries zero `TODO`s, zero `any` types, zero type-suppression comments, and two lint exceptions — a level of discipline in the top percentile of codebases at this stage.

That quality is not the problem. **Allocation is.** The product's stated differentiator — automatically capturing transactions from mobile-money messages — represents 325 lines of the codebase and has never been validated against a physical device or a real user. Meanwhile, a multi-device sync subsystem that cannot be enabled in production accounts for 1,595 lines.

The company has a well-built asset pointed at an unproven premise. The recommended action is not more engineering; it is a one-week validation exercise that either confirms or kills the core thesis before further investment.

---

# Part 1 — Engineering assessment

## 1.1 Scale and composition

| Metric | Value |
|---|---|
| Tracked files (excluding ignored) | 351 |
| Source lines | 27,189 |
| Test lines | 4,654 (17% of source) |
| Test files | 45 |
| Passing tests | 194 |
| Commits | 171 |
| Active period | 2026-04-05 → 2026-07-27 (~16 weeks) |
| Contributors | 3 |

Distribution by area: `lib/` 133 files, `components/` 130, `docs/` 25, `app/` 24, `native/android/` 16, `public/` 9.

## 1.2 What is genuinely strong

**Code hygiene is exceptional.** Measured across the full source tree:

| Signal | Count |
|---|---|
| `TODO` / `FIXME` / `HACK` | 0 |
| `any` type annotations | 0 |
| `@ts-ignore` / `@ts-expect-error` | 0 |
| `eslint-disable` | 2 |

This matters commercially: it means the codebase is an asset that a new engineer can join and extend, not a liability requiring a rewrite. Technical debt is the most common hidden cost in early-stage acquisition or investment diligence, and there is very little of it here.

**Property-based accounting invariants.** `lib/domain/accounting.property.test.ts` uses `fast-check` to assert accounting properties across generated inputs rather than hand-picked examples. This is uncommon in consumer finance software and is the correct tool for money-handling logic.

**Review-first capture.** Parsed messages never post directly to the ledger; they land in a review inbox. This is the right default for financial data and a discipline that well-funded competitors frequently get wrong.

**Encryption migration handled properly.** A metadata leak — index fields stored in plaintext to keep IndexedDB queries working — was identified and closed by moving to keyed HMAC blind indexes (`RECORD_ENVELOPE_VERSION = 2`), with transparent re-encryption of existing records via `reblindAllRecords`. Shipping a migration path rather than breaking existing data reflects mature judgment.

**Storage abstraction is real.** Two backends (IndexedDB for web, SQLite for native shells) sit behind a single `RepositoryBundle` interface, selected at runtime. This is what makes an iOS shell a build rather than a rewrite, and it materially lowers the cost of platform expansion.

**Load discipline.** Thirteen dynamic `await import()` calls defer heavy dependencies (`pdfjs-dist`, `tesseract.js`) so they cost nothing until used — relevant in a market where bandwidth and device capability are constraints.

**Continuous integration.** Typecheck, lint, test, and build run on every push and pull request.

## 1.3 What is weak

### Finding 1 — The interactive layer has no automated coverage

| Layer | Source files | Test files |
|---|---|---|
| `lib/` (domain, capture, security, sync) | 79 | 42 |
| `components/` (user interface) | 77 | 3 |

All 45 test files are `.ts`. There are **zero** `.test.tsx` files in the repository. The three tests under `components/` cover pure logic extractions, not rendered behaviour.

Every form, workspace, and the PIN screen that protects user financial data is unverified by automated testing. This is acknowledged in `docs/architecture/overview.md`, but acknowledgement does not reduce the risk.

**Impact:** regression risk concentrated in exactly the layer that changes most often and that users experience directly.

### Finding 2 — Effort is allocated inversely to strategic value

| Subsystem | Lines | Production status |
|---|---|---|
| Sync engine (`lib/sync/`) | 1,595 | Backend returns HTTP 501 by default; documented in-code as "DEV-ONLY… must not be enabled for real users" |
| Domain / accounting (`lib/domain/`) | 1,764 | Working; commodity functionality |
| Capture pipeline (`lib/capture/`) | 1,463 | Working; unvalidated on device |
| **Parser packs (`lib/capture/providers/`)** | **325** | **The differentiator.** 13 real-message fixtures |

The sync subsystem includes per-entity conflict rules, echo suppression, an outbox, and a dedicated conflict-resolution interface at `/settings/sync-conflicts` — all built against a server that refuses to run. It is approximately 6% of the source tree delivering zero user value today.

Individual parser sizes: `airtel-money-uganda` 80 lines, `mtn-uganda` 70, `shared` 63, `bank-alert-generic` 41, `centenary-uganda` 24, `index` 24, `absa-uganda` 23.

The project's own engineering principles specify *"YAGNI: implement only current requirements, avoid speculative features."* The sync subsystem is a direct departure from that standard.

### Finding 3 — Nothing has been verified on physical hardware

The Android host shell (16 files, Kotlin) is complete in source but recorded in `docs/tracker.md` as *"not device-verified."* It has never been compiled to an APK or installed on a handset.

The unverified surface includes the WebView-to-JavaScript bridge, a string-protocol SQLite command layer, and share-intent handoff — precisely the integration points where platform behaviour diverges from expectation.

**Impact:** an unquantified risk sitting directly in the critical path to launch.

### Finding 4 — Documentation has drifted on security posture

`docs/architecture/overview.md` (line 49) states that index fields *"stay plaintext so IndexedDB indexes work — a deliberate tradeoff."* The implementation has since moved to envelope version 2 with HMAC blind indexes, closing that gap entirely.

The document describes a vulnerability that no longer exists. Because this is the security section of the designated architecture reference, any reviewer, partner, or investor performing diligence will read a materially inaccurate account of the product's data protection.

A comparable drift exists in `README.md`, which lists PDF statement parsing as not built while `lib/capture/file-extractor.ts` implements PDF text extraction and OCR. (This may be a definitional distinction between text extraction and structured statement parsing, but it reads as a contradiction.)

### Finding 5 — Pilot-readiness gaps in a mobile-first product

`docs/tracker.md` records an unchecked item: **"Mobile screen sizes verified — required before pilot."** For a product whose primary surface is a phone, this is a foundational gap rather than a refinement.

### Finding 6 — Minor housekeeping

Four unreferenced assets remain in `public/` (`math (1).png`, `math (1).svg`, `moby.png`, `moby.svg`), and `.moat-sync/hosted-sync.json` — runtime state from the development sync server — is committed to version control rather than ignored.

## 1.4 Risk register

| Risk | Severity | Evidence | Mitigation |
|---|---|---|---|
| Core premise unvalidated on device | **Critical** | Android shell never compiled; 13 parser fixtures | One-week device test with real message corpus |
| UI regression risk | High | 0 of 77 component files tested | Component tests on capture, PIN, transaction entry |
| Sunk investment in unusable subsystem | High | 1,595 lines behind a 501 response | Freeze sync work until a user requires it |
| Security documentation inaccurate | Medium | `overview.md:49` vs `RECORD_ENVELOPE_VERSION = 2` | Correct before any external review |
| Parser coverage insufficient | Medium | 13 fixtures; tracker states "not provider-grade" | Expand corpus during device validation |

---

# Part 2 — Founder assessment

## 2.1 What has actually been built

A privacy-preserving personal finance application that works entirely offline, encrypts financial records at rest under a user-derived key, and models the account types that matter in Uganda — cash, mobile money, bank, and SACCO. It is engineered to a standard that would pass institutional diligence.

## 2.2 The central strategic problem

The product's defensibility rests on frictionless capture: money moves, and the transaction is recorded without the user typing anything. Assessed by platform, that capability currently stands as follows:

| Platform | Automated capture | Status |
|---|---|---|
| iOS | Not possible | Apple provides no third-party access to SMS or notification content. This is a permanent platform restriction, not a roadmap item. |
| Android | Possible | Notification-listener service written but not rolled out — no permission-grant flow, Play Store policy review outstanding, not device-verified. |
| Web / PWA | Manual only | Paste-to-app and CSV import. |

Removing what does not work today, the shipped product is a well-engineered manual-entry ledger. In that configuration it competes against every budgeting application available, against a paper notebook, and against the MTN and Airtel applications themselves — in a category where it holds no structural advantage.

**The entire strategic thesis rests on 325 lines of code that have never met a physical device or a real user.**

## 2.3 A structural feedback problem

Approximately 82% of Uganda's mobile market runs Android (per internal research). Automated capture is achievable only on Android. The founder uses iOS.

The consequence is that the person directing product decisions permanently experiences the weakest version of the product and cannot personally use the feature the business depends on. This is a serious feedback-loop defect, independent of engineering quality, and it should be corrected by acquiring an Android test device before further product decisions are taken.

## 2.4 Unresolved commercial questions

`docs/tracker.md` records four founder-level decisions as outstanding: monetisation, distribution and go-to-market, analytics instrumentation, and ownership of Data Protection and Privacy Act (PDPO) registration. These do not block a local-first pilot but do block any move beyond it.

---

# Part 3 — Commercialisation

## 3.1 The central insight

**The parser library is a more defensible asset than the consumer application.**

The consumer app is replicable by any competent team. The accumulated knowledge of how MTN Uganda, Airtel Money, Stanbic, Centenary, DFCU, and Absa actually format their transaction messages — including edge cases, fee disclosure patterns, and balance-checkpoint behaviour — is not. That asset compounds: every additional real message improves coverage and widens the gap against a new entrant.

Today that asset is thin (13 fixtures). Deliberately growing it is likely the highest-leverage investment available, and it serves the consumer product and every commercial path below simultaneously.

## 3.2 Commercialisation paths, assessed

### A. Consumer subscription
**Fit: moderate. Timeline: long.**

Mobile-money billing rails exist and recurring micro-payments are culturally established in Uganda through airtime and data bundles, which removes the usual card-penetration obstacle. Against that, consumer personal-finance software has a poor global monetisation record — Mint was acquired and ultimately discontinued despite very large user numbers — and realistic price points in this market imply that meaningful revenue requires substantial scale.

Viable as a long-term destination; unlikely to be the first revenue.

### B. Parsing infrastructure (B2B)
**Fit: strong. Timeline: medium.**

License the transaction-parsing capability as an API or SDK to other companies operating in East African fintech: lenders, expense-management tools, accounting software entering the region, and payment reconciliation providers. All of them face the identical problem and none of them want to solve it.

Advantages: business buyers pay commercially meaningful amounts; revenue does not depend on consumer scale; the asset strengthens with use. The principal consideration is that customers may include competitors, which is a positioning decision rather than a blocker.

### C. SACCO and cooperative channel
**Fit: strong. Timeline: medium.**

Uganda's savings and credit cooperative sector is large and comparatively underserved by digital tooling. A cooperative is an institutional buyer with a budget and an existing membership base, which addresses distribution and monetisation in a single relationship.

The product already models SACCO accounts as a first-class type — the domain groundwork is in place. This is likely the shortest path from the current product to institutional revenue.

### D. Credit assessment and thin-file scoring
**Fit: high value, direct architectural conflict.**

Mobile-money transaction history is among the strongest available credit signals for populations without formal banking records, and lenders pay well for it.

This path conflicts fundamentally with the local-first architecture. If data never leaves the device, it cannot be scored centrally. Pursuing it would require either an explicit user-consented export mechanism or an on-device attestation model, plus full PDPO compliance work.

This should be treated as a distinct business rather than an extension, and should not be pursued casually — it would compromise the trust position that currently differentiates the product.

### E. White-label licensing to banks and microfinance institutions
**Fit: moderate. Timeline: long.**

Financial institutions in the region generally ship poor customer-facing software. Licensing the personal finance layer is a credible enterprise motion with large contract values, offset by long sales cycles and procurement overhead that a small team may not be positioned to absorb yet.

### F. Open-source the parser, monetise the application
**Fit: strategic rather than revenue-generating.**

Publishing the parser packs as an open standard would build credibility, attract external message contributions that improve coverage at no cost, and support recruitment. Revenue would come from the consumer product or hosted services. Slow to monetise, but it accelerates the compounding of the underlying asset.

## 3.3 A decision that cannot be deferred

Local-first architecture is simultaneously the product's clearest trust differentiator and a hard constraint on any data-driven revenue model. Paths A, B, C, E, and F are compatible with it. Path D is not.

This should be settled deliberately rather than by accumulated engineering decisions. Given that Uganda's Data Protection and Privacy Act imposes real obligations, and that architectural privacy compliance is itself a credible selling point to institutional buyers, there is a defensible case for treating local-first as a permanent commitment and pursuing the B2B routes.

---

# Part 4 — Recommended sequence

**Immediate — this week.** Compile the Android shell to an APK, install it on a physical handset, and process at least 100 genuine MTN and Airtel messages through the capture pipeline. This single exercise validates or invalidates the entire strategic premise at a cost measured in days. Every other decision in this document is downstream of the result.

**If validation succeeds — weeks 2 to 6.**
1. Expand the fixture corpus from the collected messages; treat coverage as the primary engineering metric.
2. Correct the architecture and README documentation drift identified in Findings 4 and 6.
3. Add component tests covering capture, PIN entry, and transaction entry — the three paths where failure is least acceptable.
4. Complete the mobile screen-size verification outstanding on the pilot checklist.
5. Freeze all sync development until a paying or piloting user requires multi-device support.

**If validation fails.** The accounting engine, encryption layer, and storage abstraction remain sound and reusable. Reposition around fast manual entry and CSV import, or redirect toward the SACCO institutional channel where the buyer values bookkeeping structure over capture automation.

**Deferred until validation completes.** Monetisation model selection, iOS native shell development, and the visual refresh currently specified in `docs/superpowers/specs/2026-07-27-visual-refresh-design.md`.

---

## Assessment limitations

This assessment measures source code and project documentation. It does not evaluate market demand, competitive positioning against specific local products, or parser accuracy against real-world message volume — the existing corpus of 13 fixtures is insufficient to support a claim in either direction. Those questions are precisely what the recommended device validation is designed to answer.
