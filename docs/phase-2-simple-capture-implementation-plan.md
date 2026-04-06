# Phase 2 Implementation Plan: Simple Capture Platform

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Implementation plan |
| Owner | Piira |
| Last Updated | 2026-04-06 |
| Scope | Android-first capture, parser hardening, and review-first ingestion |

## Summary

Phase 2 should turn Moat from a manually entered accounting app into a review-first capture system for the channels people in Uganda already use every day.

This phase should **not** start with bank APIs or direct SMS inbox access. It should build the lowest-risk, highest-value capture channels first:

1. Share-to-app and paste-to-app intake
2. Android notification capture companion
3. Deterministic parser packs for Uganda transaction formats
4. A proper capture inbox with confidence, deduplication, and correction flow

The output of Phase 2 is not "fully automatic accounting." The output is a reliable, policy-aware ingestion platform that produces reviewable transaction candidates without corrupting the ledger.

## Why Phase 2 Starts Here

The current product already has the right accounting destination:

- ledger-first transactions
- manual capture
- CSV import
- period summaries
- month close
- reconciliation state
- capture review metadata

What is missing is the channel layer. The app can already store and review transactions; it now needs better ways to **receive** them.

The strongest path remains the one documented in the roadmap:

- build **simple capture before restricted capture**
- keep **review before posting**
- keep **direct SMS inbox reading** out of scope for this phase

## Phase 2 Objectives

1. Capture text and message-derived transactions with less manual effort.
2. Keep the ledger safe by routing machine-captured items into review before posting.
3. Support Android-first real-world use cases in Uganda without depending on bank APIs.
4. Build parser infrastructure that can grow by provider and by message family.
5. Keep the implementation compliant, auditable, and reversible.

## Non-Goals

These do **not** belong in Phase 2:

- direct `READ_SMS` inbox ingestion
- bank API integrations as the primary ingestion path
- cloud sync as a prerequisite
- auto-posting transactions without user review
- LLM-only extraction logic

## Implementation Scope

### 1. Capture Pipeline Boundary

Introduce a real ingestion layer so capture logic stops living inside route-local components.

Add:

- `lib/capture/types.ts`
- `lib/capture/pipeline.ts`
- `lib/capture/normalizers.ts`
- `lib/capture/confidence.ts`
- `lib/capture/deduplication.ts`
- `lib/capture/source-adapters/*`

#### Core entities

`CaptureSource`
- `manual_paste`
- `shared_text`
- `notification`
- `image_ocr`
- `pdf_text`
- `csv`

`CaptureEnvelope`
- `id`
- `userId`
- `source`
- `sourceApp?`
- `receivedAt`
- `rawText?`
- `rawFileName?`
- `contentHash`
- `providerReference?`
- `status`

`ParseResult`
- `id`
- `captureEnvelopeId`
- `parserId`
- `parserVersion`
- `confidenceScore`
- `fieldWarnings`
- extracted candidate transaction fields

`CaptureReviewItem`
- review state
- duplicate state
- decision metadata
- linked transaction id if approved

#### Reason

Phase 2 needs a stable ingestion target that works for:

- share intent
- paste
- notifications
- OCR/file extraction

without duplicating parsing and review logic per route.

### 2. Share-to-App and Paste-to-App

This is the first capture channel to ship fully.

#### Deliverables

- Android share intent receiver for `text/plain`
- route handoff into Moat capture inbox
- web paste fallback for all platforms
- ability to receive shared text from WhatsApp, SMS, email, or browser selections

#### Notes

The current PWA already supports text share parameters and paste-based capture. Phase 2 should formalize this into a proper ingestion path and native Android handoff, ideally via a Capacitor wrapper or equivalent Android host shell.

### 3. Android Notification Listener Companion

Build a native Android notification listener as a separate capture source.

#### Deliverables

- explicit user opt-in
- allowlist of supported apps
- source app/package metadata
- local handoff into `CaptureEnvelope`
- review-first flow, never direct posting

#### Required controls

- disabled by default
- package allowlist only
- raw content retained only as needed for review
- clear disclosure in settings and onboarding for the feature

### 4. Deterministic Parser Packs

Replace ad hoc parser growth with provider-specific parser packs.

Add:

- `lib/capture/providers/mtn-uganda.ts`
- `lib/capture/providers/airtel-money-uganda.ts`
- `lib/capture/providers/bank-alert-generic.ts`

Phase 2 initial target coverage:

- MTN MoMo Uganda debit and credit alerts
- Airtel Money Uganda debit and credit alerts
- first generic bank debit/credit alert family

Each parser pack should expose:

- `canMatch(envelope)`
- `parse(envelope)`
- `version`
- `supportedPatterns`

### 5. Capture Inbox and Review Queue

Build a dedicated capture review route instead of overloading the general transactions route.

Add route:

- `/transactions/review/capture`

Sections:

- `New`
- `Needs review`
- `Duplicates`
- `Resolved`

For each review item:

- source channel
- source app
- parser matched
- confidence score
- uncertain fields
- approve / edit / reject

This route should become the default destination for all machine-captured items.

### 6. Confidence and Field-Level Warnings

Confidence should not be one message-level number only.

Add field-level confidence and warnings for:

- amount
- date
- type
- payee
- currency
- balance if extracted

This allows the user to trust part of a parse while correcting only the uncertain parts.

### 7. Deduplication

Deduplication must be a first-class subsystem before notification capture is allowed to scale.

Add:

- content hash dedupe
- provider reference dedupe
- normalized text dedupe
- amount/date/source proximity dedupe
- duplicate linking to prior capture item or posted transaction

Rule:

- duplicates must go to review
- duplicates must never auto-post

### 8. Correction Logging

Do not auto-learn from a single correction.

Add:

- `CorrectionLog`
  - parser id
  - original parse
  - approved result
  - source type
  - timestamp

Use this for:

- parser pack refinement
- rule suggestions
- payee normalization proposals

### 9. Transaction Model Completion for Capture

The transaction model should be used consistently for captured records.

Ensure Phase 2 records carry:

- `captureEnvelopeId`
- `parserId`
- `parserVersion`
- `captureSource`
- `confidenceScore`
- `fieldWarnings`
- `providerReference`
- `sourceApp`
- `rawMessageStored`
- `rawMessageRetentionUntil`

Some of this metadata exists conceptually already; Phase 2 should make it explicit and stable.

### 10. Compliance and Privacy Controls

This is not optional if message-derived content is being ingested.

Parallel Phase 2 controls:

- consent gate before message-derived capture features are enabled
- message-source disclosure
- raw-message retention policy
- export/delete support for captured raw content
- local-only processing as default

## Architecture Recommendation

Phase 2 should not stay PWA-only.

Recommended structure:

- Next.js app remains the main UI and local-first accounting shell
- Capacitor Android wrapper (or equivalent native Android shell) is added for:
  - share intents
  - notification listener
  - file handoff
- the web layer continues to own:
  - capture inbox
  - parser pipeline
  - review queue
  - posting to IndexedDB

This preserves the current product while enabling the Android-specific platform features that a PWA alone cannot deliver reliably.

## User Flows

### Share text flow

1. User shares text to Moat from WhatsApp or another app.
2. Native shell receives the payload.
3. Payload becomes a `CaptureEnvelope`.
4. Parser pipeline produces `ParseResult` items.
5. User lands in the capture inbox.
6. User approves, edits, or rejects.
7. Approved item becomes a reviewed transaction.

### Notification capture flow

1. User enables notification capture.
2. Android listener receives allowed notification content.
3. Notification becomes a `CaptureEnvelope`.
4. Parser pipeline runs locally.
5. Candidate enters capture inbox.
6. User reviews before posting.

### OCR/document flow

1. User uploads image or PDF.
2. Text extraction runs locally.
3. Extracted text becomes a `CaptureEnvelope`.
4. Same parser + review path applies.

## Technical Milestones

### Milestone 1: Capture Foundation

Outputs:

- capture pipeline boundary
- `CaptureEnvelope` and `ParseResult` model
- capture inbox route
- shared source adapters for paste/text/file

Done when:

- all capture sources feed one shared review flow
- parser logic is no longer route-local

### Milestone 2: Share Intake

Outputs:

- Android share intent bridge
- web paste fallback retained
- capture inbox receives shared text

Done when:

- shared text from supported Android apps appears in Moat review queue

### Milestone 3: Notification Capture

Outputs:

- native Android notification listener
- allowlist
- user controls
- local ingestion into review queue

Done when:

- allowed app notifications produce review items
- no notification-derived transaction posts automatically

### Milestone 4: Parser Packs

Outputs:

- MTN pack
- Airtel pack
- first bank alert pack
- fixture corpus and regression tests

Done when:

- real message fixtures parse into high-confidence structured candidates

### Milestone 5: Confidence, Dedupe, and Corrections

Outputs:

- field-level warnings
- duplicate queue
- correction logging

Done when:

- duplicates are reliably quarantined
- parser corrections are logged for future refinement

## Test Plan

### Unit tests

- parser pack matching and extraction
- deduplication heuristics
- confidence scoring
- capture pipeline state transitions

### Regression fixtures

- MTN debit and credit messages
- Airtel debit and credit messages
- forwarded WhatsApp transaction text
- noisy OCR output
- first bank alert families

### End-to-end tests

- share text -> capture inbox
- notification payload -> capture inbox
- approve candidate -> transaction created
- reject duplicate -> no transaction created

## Acceptance Criteria

Phase 2 is complete when:

1. `/transactions` remains ledger-first and is not overloaded by capture tooling.
2. Shared text intake works end-to-end.
3. Android notification capture works with explicit opt-in and allowlist controls.
4. MTN, Airtel, and first bank parser packs are live.
5. All machine-captured records go through review before posting.
6. Duplicates are surfaced and blocked from silent posting.
7. Capture metadata is stored consistently and is exportable/deletable.
8. The implementation is covered by parser and capture tests, not just UI tests.

## Recommended GitHub Breakdown

Use these workstreams:

- Capture foundation and inbox
- Share intent bridge
- Notification listener companion
- Parser pack architecture
- MTN/Airtel/bank parser packs
- Deduplication and confidence
- Correction logging and refinement workflow

## Notes

- Direct SMS inbox access remains a separate Phase 4 policy decision.
- Bank APIs remain optional later integrations, not the core ingestion strategy.
- The review queue is the safety boundary that protects the ledger from parser mistakes.
