# Moat — Architecture Overview

| Field | Value |
|-------|-------|
| Status | Active |
| Last updated | 2026-07-19 |
| Supersedes | `docs/uganda-finance-technical-architecture.md` (removed — described the pre-build scaffold) |

This document describes the system as implemented. Status of individual features lives in [../tracker.md](../tracker.md).

## Shape of the system

Moat is a local-first Next.js 16 (App Router) application. Every route under `app/` is a thin, statically rendered server shell that mounts a `"use client"` workspace component; all data access happens on the client against on-device storage. There is no server-side data fetching and no required backend — the only API surface is the optional, dev-only sync stub under `app/api/v1/sync/`.

Layers, with dependencies pointing strictly downward:

```
app/ + components/          UI: route shells, workspace hooks, forms
        │
lib/capture, lib/sync,      orchestration: capture pipeline, outbox sync,
lib/security, lib/app-state PIN/encryption, bootstrap defaults
        │
lib/repositories            persistence abstraction (IndexedDB | SQLite)
        │
lib/domain                  pure financial logic — no I/O, no React
        │
lib/types.ts                shared domain vocabulary
```

## Domain layer (`lib/domain/`)

Pure synchronous functions over plain data: ledgers and balance reconciliation (`accounts.ts`), month summaries (`summaries.ts` — `savings = inflow − outflow`, `net = inflow − outflow − allocatedSavings`), goal contribution plans and derived goal progress (`goals.ts` — progress = manual starting amount + savings contributions on the linked account), budgets, debt, recurring obligations, transaction rules, month-close evaluation, and investment guidance. This layer has the deepest test coverage, including property-based accounting invariants (`accounting.property.test.ts`).

## Persistence (`lib/repositories/`)

A shared `RepositoryBundle` interface with two parallel backends:

- **IndexedDB** (`indexeddb/`) for the browser/PWA, with stepped schema migrations (`DATABASE_VERSION` in `client.ts`).
- **SQLite** (`sqlite/`) for the native Android shell, delegating typed commands over the `moatHostBridge` JS bridge.

`instance.ts` selects the backend at runtime (SQLite when the native bridge exists, IndexedDB otherwise) behind a lazy memoized proxy. Mutating operations enqueue `SyncOutboxItem`s when hosted sync is opted in.

**Reconciliation is display-time, not load-time.** Workspace hooks reconcile balances in memory for rendering; reconciled balances are persisted only after ledger mutations, and only for accounts whose balance actually changed.

## Security (`lib/security/`)

- **PIN policy** (`pin-policy.ts`): minimum 6 digits, escalating unlock throttling (30s after 5 failures, doubling, capped at 15 minutes), attempt state in localStorage.
- **PIN lock** (`pin-lock-context.tsx`): PBKDF2-SHA256 (310k iterations) derives a session key; only an encrypted sentinel is stored. 5-minute inactivity auto-lock.
- **Record encryption** (`record-crypto.ts`): AES-GCM-256 envelope per record; the key lives in memory only and clears on lock. Index fields (userId, dates, status) stay plaintext so IndexedDB indexes work — a deliberate tradeoff.
- **Posture: PIN + encryption is the onboarding default.** Onboarding creates the PIN before the first record is written, so data is encrypted from day one. Opting out is possible but shows an explicit warning. Restore flows accept legacy 4-digit backup PINs so old backups remain recoverable.
- **Backups** (`encrypted-backup.ts`, `integrations/google-drive-backup.ts`): PIN-encrypted `.enc` blobs to file or Google Drive appdata scope.

Known gaps (tracked): no formal threat-model doc; plaintext JSON export path exists by design.

## Capture platform (`lib/capture/`)

Pipeline: **source adapter → envelope (content-hashed) → parse → normalize → confidence score → dedupe → review item**. Parser packs (`providers/`: MTN, Airtel, generic bank alerts) are plain functions tried in order; adding a provider is one function plus a registry entry. Dedupe is two-tier: exact message-hash match plus a fuzzy composite (account + date + type + amount + payee). Everything lands in a review-first inbox — captures never post directly to the ledger.

Native captures arrive through `lib/native/capture-bridge.ts`: the Android shell pushes typed payloads into `window.__moatPendingCapturePayloads` / `window.moatNativeCapture.ingest`, re-dispatched as DOM events with a pending queue so nothing is dropped before a listener mounts.

## Sync (`lib/sync/`)

Offline outbox model. The client engine (`engine.ts`) pushes pending outbox items, maps per-item results, pulls server changes, and applies them with echo suppression. Conflict strategy is per-entity (`entity-sync.ts`): reference data is client-wins, month-closes server-wins, and all ledger-affecting entities go to **manual review** (`conflicts.ts`) — money records are never silently overwritten.

> **The server side is dev-only.** `hosted-store.ts` is a single-process JSON file with a shared bearer token and no per-user tenancy. Routes return 501 unless explicitly flag-enabled, and refuse to run the backend without a token. Real hosted sync requires per-user auth and a real database first. See [sync.md](sync.md).

## Native shell (`native/android/`)

A hand-rolled Kotlin WebView host (not Capacitor): `MainActivity` loads the web app and injects `moatHostBridge` (SQLite storage commands, capture settings, route hints) and the capture bridge. `ShareReceiverActivity` handles Android share-sheet intents end to end. A notification-listener service exists in code but is not rolled out (Play policy review risk; no permission-grant UX yet). The shell has not been built into an APK or device-verified.

## PWA / offline

`app/manifest.ts` defines install metadata and a `share_target`. `public/sw.js` precaches the app shell and all manifest icons (guarded by `lib/pwa/service-worker.test.ts`), serves visited pages network-first with cache fallback so they keep working offline, and falls back to `/offline`. Static assets are cached cache-first.

## Testing & CI

Vitest across `lib/` (domain, repositories, sync, capture, security, PWA) plus pure extractions from the transactions workspace (`transaction-builder`, `month-close-export`). CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, and build on every push and PR. Known gap: no component/E2E coverage of the interactive layer yet.
